// src/screens/GalleryScreen.tsx

import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGalleryStore } from '../stores/galleryStore';
import { useSyncStore } from '../stores/syncStore';
import { PhotoRecord, GalleryStackParamList } from '../types';
import { groupPhotosByDate } from '../utils/dateHelpers';
import * as localDb from '../database/localDb';
import * as s3Service from '../services/s3Service';
import { getIdentityIdSync } from '../services/credentialManager';
import * as FileSystem from 'expo-file-system/legacy';
import { scanPhotos } from '../services/photoScanner';
import { startUploadEngine } from '../services/uploadEngine';

import PhotoTile from '../components/PhotoTile';
import SyncProgressBar from '../components/SyncProgressBar';
import SkeletonGrid from '../components/SkeletonGrid';
import DateSectionHeader from '../components/DateSectionHeader';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = (SCREEN_WIDTH - 4) / 3;

type Props = {
  navigation: NativeStackNavigationProp<GalleryStackParamList, 'GalleryGrid'>;
};

// Flatten grouped photos into a list with section headers
type ListItem =
  | { type: 'header'; title: string }
  | { type: 'row'; photos: PhotoRecord[] };

function buildListData(photos: PhotoRecord[]): ListItem[] {
  const sections = groupPhotosByDate(photos);
  const items: ListItem[] = [];

  for (const section of sections) {
    items.push({ type: 'header', title: section.title });
    // Group photos into rows of 3
    for (let i = 0; i < section.data.length; i += 3) {
      items.push({ type: 'row', photos: section.data.slice(i, i + 3) });
    }
  }

  return items;
}

export default function GalleryScreen({ navigation }: Props) {
  const { photos, isLoading, hasMore, loadPhotos, loadMore, refresh, selectedPhotos, toggleSelection, isSelectionMode } =
    useGalleryStore();
  const { isScanning, setScanning, setScanProgress } = useSyncStore();
  const [thumbnailPaths, setThumbnailPaths] = useState<Record<string, string>>({});
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    loadPhotos();

    // Start scanning in the background
    (async () => {
      try {
        setScanning(true);
        await scanPhotos((scanned, total) => {
          setScanProgress(scanned, total);
        });
        setScanning(false);

        // After scan, start uploading
        startUploadEngine();
      } catch {
        setScanning(false);
      }
    })();
  }, []);

  // Load thumbnail paths for visible photos
  useEffect(() => {
    const loadThumbnails = async () => {
      const identityId = getIdentityIdSync();
      if (!identityId) return;

      const newPaths: Record<string, string> = {};
      for (const photo of photos) {
        if (thumbnailPaths[photo.photoId]) continue;

        // Check local cache first
        const cached = await localDb.getCachedThumbnail(photo.photoId);
        if (cached) {
          const info = await FileSystem.getInfoAsync(cached.localPath);
          if (info.exists) {
            newPaths[photo.photoId] = cached.localPath;
            continue;
          }
        }

        // Download from S3 and cache
        try {
          const savePath = `${FileSystem.cacheDirectory}thumb_${photo.photoId}.jpg`;
          await s3Service.downloadThumbnail(identityId, photo.photoId, savePath);
          await localDb.insertThumbnailCache({
            photoId: photo.photoId,
            localPath: savePath,
            cachedAt: new Date().toISOString(),
          });
          newPaths[photo.photoId] = savePath;
        } catch {
          // Thumbnail download failed — will show placeholder
        }
      }

      if (Object.keys(newPaths).length > 0) {
        setThumbnailPaths((prev) => ({ ...prev, ...newPaths }));
      }
    };

    if (photos.length > 0) {
      loadThumbnails();
    }
  }, [photos]);

  const listData = buildListData(photos);

  const handlePhotoPress = useCallback(
    (photo: PhotoRecord) => {
      if (isSelectionMode) {
        toggleSelection(photo.photoId);
      } else {
        navigation.navigate('ImageViewer', { photoId: photo.photoId, photo });
      }
    },
    [isSelectionMode, navigation, toggleSelection]
  );

  const handlePhotoLongPress = useCallback(
    (photo: PhotoRecord) => {
      toggleSelection(photo.photoId);
    },
    [toggleSelection]
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return <DateSectionHeader title={item.title} />;
      }

      return (
        <View style={styles.row}>
          {item.photos.map((photo) => (
            <PhotoTile
              key={photo.photoId}
              thumbnailUri={thumbnailPaths[photo.photoId] ?? null}
              isSelected={selectedPhotos.has(photo.photoId)}
              onPress={() => handlePhotoPress(photo)}
              onLongPress={() => handlePhotoLongPress(photo)}
            />
          ))}
        </View>
      );
    },
    [thumbnailPaths, selectedPhotos, handlePhotoPress, handlePhotoLongPress]
  );

  const keyExtractor = useCallback(
    (item: ListItem, index: number) => {
      if (item.type === 'header') return `header-${item.title}-${index}`;
      return `row-${item.photos.map((p) => p.photoId).join('-')}`;
    },
    []
  );

  if (isLoading && photos.length === 0) {
    return (
      <View style={styles.container}>
        <SyncProgressBar />
        <SkeletonGrid />
      </View>
    );
  }

  if (!isLoading && photos.length === 0) {
    return (
      <View style={styles.container}>
        <SyncProgressBar />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No photos synced yet</Text>
          <Text style={styles.emptySubtitle}>
            {isScanning
              ? 'Scanning your photo library...'
              : 'Your photos will appear here once uploaded'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SyncProgressBar />
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={() => hasMore && loadMore()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refresh} />
        }
        getItemLayout={undefined}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

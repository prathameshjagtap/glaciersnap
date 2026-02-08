// src/screens/ImageViewerScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { GalleryStackParamList } from '../types';
import { getIdentityIdSync } from '../services/credentialManager';
import * as s3Service from '../services/s3Service';
import * as dynamoService from '../services/dynamoService';
import * as localDb from '../database/localDb';
import { useGalleryStore } from '../stores/galleryStore';
import RestoreButton from '../components/RestoreButton';
import { formatBytes } from '../utils/formatBytes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  navigation: NativeStackNavigationProp<GalleryStackParamList, 'ImageViewer'>;
  route: RouteProp<GalleryStackParamList, 'ImageViewer'>;
};

export default function ImageViewerScreen({ navigation, route }: Props) {
  const { photo } = route.params;
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const removePhoto = useGalleryStore((s) => s.removePhoto);

  useEffect(() => {
    loadImage();
  }, []);

  const loadImage = async () => {
    // Try local cache first
    const cached = await localDb.getCachedThumbnail(photo.photoId);
    if (cached) {
      const info = await FileSystem.getInfoAsync(cached.localPath);
      if (info.exists) {
        setImageUri(cached.localPath);
        return;
      }
    }

    // Download thumbnail from S3
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    try {
      const savePath = `${FileSystem.cacheDirectory}thumb_${photo.photoId}.jpg`;
      await s3Service.downloadThumbnail(identityId, photo.photoId, savePath);
      setImageUri(savePath);
    } catch {
      // Failed to load image
    }
  };

  const handleFullResReady = (localPath: string) => {
    setImageUri(localPath);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Photo',
      'This will permanently delete this photo from the cloud. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]
    );
  };

  const confirmDelete = async () => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    setIsDeleting(true);
    try {
      const ext = photo.originalKey.split('.').pop() ?? 'jpg';
      await s3Service.deleteFromS3(identityId, photo.photoId, ext);
      await dynamoService.deletePhotoRecord(identityId, photo.photoId);
      removePhoto(photo.photoId);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to delete photo');
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Image area with scroll zoom */}
      <ScrollView
        style={styles.imageContainer}
        contentContainerStyle={styles.imageContent}
        maximumZoomScale={5}
        minimumZoomScale={1}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bouncesZoom
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.loadingImage}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </ScrollView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topButton}>
          <Text style={styles.topButtonText}>Close</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowInfo(!showInfo)} style={styles.topButton}>
          <Text style={styles.topButtonText}>Info</Text>
        </TouchableOpacity>
      </View>

      {/* Info overlay */}
      {showInfo && (
        <View style={styles.infoOverlay}>
          <Text style={styles.infoText}>File: {photo.fileName}</Text>
          <Text style={styles.infoText}>
            Date: {new Date(photo.dateTaken).toLocaleDateString()}
          </Text>
          <Text style={styles.infoText}>
            Size: {formatBytes(photo.fileSize)}
          </Text>
          <Text style={styles.infoText}>
            Dimensions: {photo.width} x {photo.height}
          </Text>
          {photo.gpsLat != null && photo.gpsLon != null && (
            <Text style={styles.infoText}>
              Location: {photo.gpsLat.toFixed(4)}, {photo.gpsLon.toFixed(4)}
            </Text>
          )}
          <Text style={styles.infoText}>Status: {photo.restoreStatus}</Text>
        </View>
      )}

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={isDeleting}
        >
          <Text style={styles.deleteText}>{isDeleting ? 'Deleting...' : 'Delete'}</Text>
        </TouchableOpacity>

        <RestoreButton photo={photo} onFullResReady={handleFullResReady} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
  },
  imageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  loadingImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  topButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  infoOverlay: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    color: '#fff',
    fontSize: 13,
    marginBottom: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  deleteButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  deleteText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

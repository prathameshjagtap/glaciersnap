// src/screens/RestoreQueueScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRestoreStore } from '../stores/restoreStore';
import { PhotoRecord } from '../types';
import * as localDb from '../database/localDb';
import * as FileSystem from 'expo-file-system/legacy';

export default function RestoreQueueScreen() {
  const { restoringPhotos, isPolling, lastPollTime, pollAllRestores, pollSingleRestore, loadRestoreQueue } =
    useRestoreStore();
  const [thumbnailPaths, setThumbnailPaths] = useState<Record<string, string>>({});
  const [pollingId, setPollingId] = useState<string | null>(null);

  useEffect(() => {
    loadRestoreQueue();
  }, []);

  // Load thumbnail paths for restoring photos
  useEffect(() => {
    const loadThumbs = async () => {
      const paths: Record<string, string> = {};
      for (const photo of restoringPhotos) {
        const cached = await localDb.getCachedThumbnail(photo.photoId);
        if (cached) {
          const info = await FileSystem.getInfoAsync(cached.localPath);
          if (info.exists) {
            paths[photo.photoId] = cached.localPath;
          }
        }
      }
      setThumbnailPaths(paths);
    };
    if (restoringPhotos.length > 0) {
      loadThumbs();
    }
  }, [restoringPhotos]);

  const handleCheckSingle = async (photo: PhotoRecord) => {
    setPollingId(photo.photoId);
    await pollSingleRestore(photo);
    setPollingId(null);
  };

  const getTimeSinceRequest = (photo: PhotoRecord): string => {
    if (!photo.restoreRequestedAt) return '';
    const requestedAt = new Date(photo.restoreRequestedAt).getTime();
    const now = Date.now();
    const hours = Math.floor((now - requestedAt) / (1000 * 60 * 60));
    if (hours < 1) return 'Less than 1 hour ago';
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  };

  const renderItem = ({ item: photo }: { item: PhotoRecord }) => (
    <View style={styles.item}>
      {thumbnailPaths[photo.photoId] ? (
        <Image
          source={{ uri: thumbnailPaths[photo.photoId] }}
          style={styles.thumbnail}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.placeholderThumb]} />
      )}
      <View style={styles.info}>
        <Text style={styles.fileName} numberOfLines={1}>
          {photo.fileName}
        </Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.badge,
              photo.restoreStatus === 'restored' ? styles.badgeGreen : styles.badgeOrange,
            ]}
          >
            <Text style={styles.badgeText}>
              {photo.restoreStatus === 'restored' ? 'Ready' : 'Restoring...'}
            </Text>
          </View>
          <Text style={styles.timeText}>{getTimeSinceRequest(photo)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => handleCheckSingle(photo)}
        disabled={pollingId === photo.photoId}
      >
        {pollingId === photo.photoId ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Text style={styles.checkButtonText}>Check</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restore Queue</Text>
        <TouchableOpacity
          style={styles.checkAllButton}
          onPress={pollAllRestores}
          disabled={isPolling}
        >
          {isPolling ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.checkAllText}>Check All</Text>
          )}
        </TouchableOpacity>
      </View>

      {lastPollTime && (
        <Text style={styles.lastPoll}>
          Last checked: {lastPollTime.toLocaleTimeString()}
        </Text>
      )}

      {restoringPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No restores in progress</Text>
          <Text style={styles.emptySubtitle}>
            When you request a high quality photo from the archive, it will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={restoringPhotos}
          renderItem={renderItem}
          keyExtractor={(item) => item.photoId}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  checkAllButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  checkAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  lastPoll: {
    fontSize: 12,
    color: '#888',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  list: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 6,
  },
  placeholderThumb: {
    backgroundColor: '#e5e5e5',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeOrange: {
    backgroundColor: '#fff7ed',
  },
  badgeGreen: {
    backgroundColor: '#f0fdf4',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d97706',
  },
  timeText: {
    fontSize: 12,
    color: '#888',
  },
  checkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  checkButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
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

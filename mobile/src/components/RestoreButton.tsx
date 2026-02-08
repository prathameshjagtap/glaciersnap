// src/components/RestoreButton.tsx

import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';
import * as s3Service from '../services/s3Service';
import * as dynamoService from '../services/dynamoService';
import * as localDb from '../database/localDb';
import { getIdentityIdSync } from '../services/credentialManager';
import { PhotoRecord } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

type RestoreState = 'loading' | 'available' | 'archived' | 'restoring' | 'restored';

interface Props {
  photo: PhotoRecord;
  onFullResReady?: (localPath: string) => void;
}

export default function RestoreButton({ photo, onFullResReady }: Props) {
  const [state, setState] = useState<RestoreState>('loading');
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    checkStatus();
  }, [photo.photoId]);

  const checkStatus = async () => {
    setState('loading');
    try {
      const head = await s3Service.getOriginalHead(photo.originalKey);

      if (!head.storageClass || head.storageClass === 'STANDARD') {
        setState('available');
      } else if (head.restore.isRestored) {
        setState('restored');
      } else if (head.restore.isRestoring) {
        setState('restoring');
      } else {
        setState('archived');
      }
    } catch {
      // If HeadObject fails (e.g. object in Glacier without restore), treat as archived
      setState('archived');
    }
  };

  const handlePress = async () => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    if (state === 'available' || state === 'restored') {
      // Download the full-res image
      setIsActing(true);
      try {
        const savePath = `${FileSystem.cacheDirectory}fullres_${photo.photoId}.jpg`;
        await s3Service.downloadOriginal(photo.originalKey, savePath);
        onFullResReady?.(savePath);

        if (state === 'restored') {
          await dynamoService.updateRestoreStatus(identityId, photo.photoId, 'restored');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to download photo');
      } finally {
        setIsActing(false);
      }
    } else if (state === 'archived') {
      // Show restore options
      Alert.alert(
        'Restore Photo',
        'This photo is archived for cost savings. Choose a restore speed:',
        [
          {
            text: 'Budget (12-48 hours)',
            onPress: () => triggerRestore('Bulk'),
          },
          {
            text: 'Standard (~12 hours)',
            onPress: () => triggerRestore('Standard'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else if (state === 'restoring') {
      checkStatus();
    }
  };

  const triggerRestore = async (tier: 'Bulk' | 'Standard') => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    setIsActing(true);
    try {
      await s3Service.restoreOriginal(photo.originalKey, tier);
      const now = new Date().toISOString();
      await dynamoService.updateRestoreStatus(identityId, photo.photoId, 'restoring', now);
      await localDb.insertRestoreRequest({
        photoId: photo.photoId,
        status: 'restoring',
        requestedAt: now,
        tier,
        estimatedCompletion: tier === 'Bulk'
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        lastPolled: now,
      });
      setState('restoring');
    } catch (error: any) {
      if (error.name === 'RestoreAlreadyInProgressException' ||
          error.message?.includes('RestoreAlreadyInProgress')) {
        setState('restoring');
      } else {
        Alert.alert('Error', error.message || 'Failed to start restore');
      }
    } finally {
      setIsActing(false);
    }
  };

  const getButtonConfig = () => {
    switch (state) {
      case 'loading':
        return { text: 'Checking...', color: '#6b7280', disabled: true };
      case 'available':
        return { text: 'View Full Quality', color: '#16a34a', disabled: false };
      case 'archived':
        return { text: 'Get High Quality', color: '#2563eb', disabled: false };
      case 'restoring':
        return { text: 'Restoring... check back later', color: '#d97706', disabled: false };
      case 'restored':
        return { text: 'View Full Quality', color: '#16a34a', disabled: false };
    }
  };

  const config = getButtonConfig();

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: config.color }, config.disabled && styles.disabled]}
      onPress={handlePress}
      disabled={config.disabled || isActing}
    >
      {isActing || state === 'loading' ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <View style={styles.content}>
          <Text style={styles.buttonText}>{config.text}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 180,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

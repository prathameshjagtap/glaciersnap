// src/services/photoScanner.ts

import * as MediaLibrary from 'expo-media-library';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevicePhoto } from '../types';
import * as localDb from '../database/localDb';

const LAST_SCAN_KEY = 'glaciersnap_last_scan_timestamp';
const BATCH_SIZE = 50;

export async function requestPermissions(): Promise<boolean> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function scanPhotos(
  onProgress?: (scanned: number, total: number) => void
): Promise<number> {
  const hasPermission = await requestPermissions();
  if (!hasPermission) throw new Error('Photo library permission denied');

  const lastScan = await AsyncStorage.getItem(LAST_SCAN_KEY);
  const createdAfter = lastScan ? parseInt(lastScan, 10) : undefined;

  // Get total count first
  const totalResult = await MediaLibrary.getAssetsAsync({
    first: 1,
    mediaType: MediaLibrary.MediaType.photo,
    ...(createdAfter ? { createdAfter } : {}),
  });
  const totalCount = totalResult.totalCount;

  let scanned = 0;
  let hasMore = true;
  let cursor: string | undefined;

  while (hasMore) {
    const page = await MediaLibrary.getAssetsAsync({
      first: BATCH_SIZE,
      after: cursor,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      ...(createdAfter ? { createdAfter } : {}),
    });

    for (const asset of page.assets) {
      // Skip if already scanned
      const exists = await localDb.devicePhotoExists(asset.id);
      if (exists) {
        scanned++;
        continue;
      }

      // Get asset info for file URI
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset.id);
      const fileUri = assetInfo.localUri ?? asset.uri;

      // Compute SHA256 hash
      let fileHash: string | null = null;
      try {
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // digestStringAsync expects base64 input for binary data
        fileHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          fileContent,
          { encoding: Crypto.CryptoEncoding.Base64 }
        );
      } catch (error) {
        // Hash computation failed — we'll still index the photo, hash will be null
        console.warn('Failed to compute file hash:', error);
      }

      const devicePhoto: DevicePhoto = {
        localId: asset.id,
        filePath: fileUri,
        fileHash,
        fileSize: (assetInfo as any).fileSize ?? null,
        width: asset.width,
        height: asset.height,
        dateTaken: asset.creationTime
          ? new Date(asset.creationTime).toISOString()
          : new Date(asset.modificationTime).toISOString(),
        gpsLat: (assetInfo as any).location?.latitude ?? null,
        gpsLon: (assetInfo as any).location?.longitude ?? null,
        syncStatus: 'not_synced',
        photoId: null,
        thumbnailCachePath: null,
        lastSyncAttempt: null,
        errorMessage: null,
      };

      await localDb.insertDevicePhoto(devicePhoto);
      scanned++;
    }

    onProgress?.(scanned, totalCount);
    hasMore = page.hasNextPage;
    cursor = page.endCursor;
  }

  // Save scan timestamp
  await AsyncStorage.setItem(LAST_SCAN_KEY, Date.now().toString());
  return scanned;
}

// src/services/uploadEngine.ts

import { ulid } from 'ulid';
import { getIdentityIdSync } from './credentialManager';
import * as s3Service from './s3Service';
import * as dynamoService from './dynamoService';
import * as localDb from '../database/localDb';
import { generateThumbnail } from './thumbnailGenerator';
import { PhotoRecord, DevicePhoto } from '../types';
import { useSyncStore } from '../stores/syncStore';

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
let isRunning = false;
let shouldStop = false;

export function stopUploadEngine(): void {
  shouldStop = true;
}

export async function startUploadEngine(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  shouldStop = false;

  const store = useSyncStore.getState();
  store.setSyncing(true);

  try {
    while (!shouldStop) {
      const batch = await localDb.getUnsyncedPhotos(MAX_CONCURRENT * 2);
      if (batch.length === 0) break;

      // Process in parallel with concurrency limit
      const chunks = [];
      for (let i = 0; i < batch.length; i += MAX_CONCURRENT) {
        chunks.push(batch.slice(i, i + MAX_CONCURRENT));
      }

      for (const chunk of chunks) {
        if (shouldStop) break;

        useSyncStore.getState().setCurrentlyUploading(chunk.length);
        await Promise.allSettled(chunk.map((photo) => uploadSinglePhoto(photo)));

        // Update progress
        const synced = await localDb.getSyncedCount();
        const total = await localDb.getDevicePhotoCount();
        useSyncStore.getState().setSyncProgress(synced, total, 0);
      }
    }
  } finally {
    isRunning = false;
    useSyncStore.getState().setSyncing(false);
    useSyncStore.getState().setCurrentlyUploading(0);
  }
}

async function uploadSinglePhoto(photo: DevicePhoto, attempt: number = 0): Promise<void> {
  const identityId = getIdentityIdSync();
  if (!identityId) throw new Error('Not authenticated');

  try {
    // 1. Generate photoId
    const photoId = ulid();

    // 2. Duplicate detection
    if (photo.fileHash) {
      const existing = await dynamoService.queryByHash(identityId, photo.fileHash);
      if (existing) {
        // Already uploaded — mark as synced locally
        await localDb.markAsSynced(photo.localId);
        return;
      }
    }

    // 3. Mark as uploading
    await localDb.markAsUploading(photo.localId, photoId);

    // 4. Generate thumbnail if not cached
    let thumbnailUri = photo.thumbnailCachePath;
    if (!thumbnailUri) {
      thumbnailUri = await generateThumbnail(photo.filePath, photo.localId);
    }

    // 5. Determine content type
    const contentType = photo.filePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : photo.filePath.toLowerCase().endsWith('.heic')
      ? 'image/heic'
      : 'image/jpeg';

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/heic' ? 'heic' : 'jpg';

    // 6. Create DynamoDB record with status "uploading"
    const record: PhotoRecord = {
      userId: identityId,
      photoId,
      originalKey: `${identityId}/${photoId}/original.${ext}`,
      thumbnailKey: `${identityId}/${photoId}/thumb.jpg`,
      fileName: photo.filePath.split('/').pop() ?? 'photo',
      contentType,
      fileHash: photo.fileHash ?? '',
      fileSize: photo.fileSize ?? 0,
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      dateTaken: photo.dateTaken ?? new Date().toISOString(),
      gpsLat: photo.gpsLat,
      gpsLon: photo.gpsLon,
      uploadStatus: 'uploading',
      restoreStatus: 'none',
      restoreRequestedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoService.createPhotoRecord(record);

    // 7. Upload original to S3
    await s3Service.uploadOriginal(identityId, photoId, photo.filePath, contentType);

    // 8. Upload thumbnail to S3
    await s3Service.uploadThumbnail(identityId, photoId, thumbnailUri);

    // 9. Update DynamoDB status to "complete"
    await dynamoService.updateUploadStatus(identityId, photoId, 'complete');

    // 10. Mark as synced in local DB
    await localDb.markAsSynced(photo.localId);
  } catch (error: any) {
    // Retry on transient failures (network errors, throttling)
    if (attempt < MAX_RETRIES) {
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return uploadSinglePhoto(photo, attempt + 1);
    }
    await localDb.markAsFailed(photo.localId, error.message ?? 'Upload failed');
  }
}

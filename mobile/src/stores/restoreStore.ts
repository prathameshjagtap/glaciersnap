// src/stores/restoreStore.ts

import { create } from 'zustand';
import { PhotoRecord } from '../types';
import * as dynamoService from '../services/dynamoService';
import * as s3Service from '../services/s3Service';
import { getIdentityIdSync } from '../services/credentialManager';
import * as localDb from '../database/localDb';

interface RestoreState {
  restoringPhotos: PhotoRecord[];
  isPolling: boolean;
  lastPollTime: Date | null;
  restoringCount: number;

  pollAllRestores: () => Promise<void>;
  pollSingleRestore: (photo: PhotoRecord) => Promise<'restoring' | 'restored'>;
  loadRestoreQueue: () => Promise<void>;
}

export const useRestoreStore = create<RestoreState>((set, get) => ({
  restoringPhotos: [],
  isPolling: false,
  lastPollTime: null,
  restoringCount: 0,

  loadRestoreQueue: async () => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    try {
      const photos = await dynamoService.queryRestoringPhotos(identityId);
      set({ restoringPhotos: photos, restoringCount: photos.length });
    } catch {
      // Ignore errors — queue will be refreshed on next poll
    }
  },

  pollAllRestores: async () => {
    const identityId = getIdentityIdSync();
    if (!identityId || get().isPolling) return;

    set({ isPolling: true });
    try {
      const photos = await dynamoService.queryRestoringPhotos(identityId);
      const updated: PhotoRecord[] = [];

      for (const photo of photos) {
        try {
          const headResult = await s3Service.getOriginalHead(photo.originalKey);
          if (headResult.restore.isRestored) {
            // Restore complete!
            await dynamoService.updateRestoreStatus(identityId, photo.photoId, 'restored');
            await localDb.updateRestoreStatus(photo.photoId, 'restored');
            // Don't add to the "restoring" list — it's done
          } else {
            updated.push(photo);
          }
        } catch {
          updated.push(photo); // Keep in list if check fails
        }
      }

      set({
        restoringPhotos: updated,
        restoringCount: updated.length,
        lastPollTime: new Date(),
      });
    } finally {
      set({ isPolling: false });
    }
  },

  pollSingleRestore: async (photo) => {
    try {
      const headResult = await s3Service.getOriginalHead(photo.originalKey);
      const identityId = getIdentityIdSync();

      if (headResult.restore.isRestored && identityId) {
        await dynamoService.updateRestoreStatus(identityId, photo.photoId, 'restored');
        await localDb.updateRestoreStatus(photo.photoId, 'restored');

        // Remove from restoring list
        const current = get().restoringPhotos;
        set({
          restoringPhotos: current.filter((p) => p.photoId !== photo.photoId),
          restoringCount: current.length - 1,
        });
        return 'restored';
      }
      return 'restoring';
    } catch {
      return 'restoring';
    }
  },
}));

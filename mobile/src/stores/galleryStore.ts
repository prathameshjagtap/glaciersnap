// src/stores/galleryStore.ts

import { create } from 'zustand';
import { PhotoRecord } from '../types';
import * as dynamoService from '../services/dynamoService';
import { getIdentityIdSync } from '../services/credentialManager';

interface GalleryState {
  photos: PhotoRecord[];
  isLoading: boolean;
  hasMore: boolean;
  cursor: Record<string, any> | undefined;
  selectedPhotos: Set<string>; // Set of photoIds
  isSelectionMode: boolean;

  loadPhotos: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleSelection: (photoId: string) => void;
  clearSelection: () => void;
  removePhoto: (photoId: string) => void;
}

export const useGalleryStore = create<GalleryState>((set, get) => ({
  photos: [],
  isLoading: false,
  hasMore: true,
  cursor: undefined,
  selectedPhotos: new Set(),
  isSelectionMode: false,

  loadPhotos: async () => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    set({ isLoading: true });
    try {
      const page = await dynamoService.queryPhotosByDate(identityId, { limit: 60 });
      set({
        photos: page.photos,
        cursor: page.cursor,
        hasMore: page.hasMore,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, cursor, isLoading, photos } = get();
    if (!hasMore || isLoading) return;

    const identityId = getIdentityIdSync();
    if (!identityId) return;

    set({ isLoading: true });
    try {
      const page = await dynamoService.queryPhotosByDate(identityId, {
        limit: 60,
        cursor,
      });
      set({
        photos: [...photos, ...page.photos],
        cursor: page.cursor,
        hasMore: page.hasMore,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    set({ photos: [], cursor: undefined, hasMore: true });
    await get().loadPhotos();
  },

  toggleSelection: (photoId) => {
    const selected = new Set(get().selectedPhotos);
    if (selected.has(photoId)) {
      selected.delete(photoId);
    } else {
      selected.add(photoId);
    }
    set({ selectedPhotos: selected, isSelectionMode: selected.size > 0 });
  },

  clearSelection: () => {
    set({ selectedPhotos: new Set(), isSelectionMode: false });
  },

  removePhoto: (photoId) => {
    set({ photos: get().photos.filter((p) => p.photoId !== photoId) });
  },
}));

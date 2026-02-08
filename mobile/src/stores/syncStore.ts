// src/stores/syncStore.ts

import { create } from 'zustand';

interface SyncState {
  isScanning: boolean;
  scannedCount: number;
  totalDevicePhotos: number;
  isSyncing: boolean;
  syncedCount: number;
  totalToSync: number;
  failedCount: number;
  currentlyUploading: number;

  setScanProgress: (scanned: number, total: number) => void;
  setScanning: (isScanning: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  setSyncProgress: (synced: number, total: number, failed: number) => void;
  setCurrentlyUploading: (count: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  isScanning: false,
  scannedCount: 0,
  totalDevicePhotos: 0,
  isSyncing: false,
  syncedCount: 0,
  totalToSync: 0,
  failedCount: 0,
  currentlyUploading: 0,

  setScanProgress: (scanned, total) => set({ scannedCount: scanned, totalDevicePhotos: total }),
  setScanning: (isScanning) => set({ isScanning }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setSyncProgress: (synced, total, failed) => set({ syncedCount: synced, totalToSync: total, failedCount: failed }),
  setCurrentlyUploading: (count) => set({ currentlyUploading: count }),
}));

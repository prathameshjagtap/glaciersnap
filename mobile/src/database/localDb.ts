// src/database/localDb.ts

import * as SQLite from 'expo-sqlite';
import { DevicePhoto, ThumbnailCacheEntry, RestoreQueueItem } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('glaciersnap.db');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS device_photos (
      localId TEXT PRIMARY KEY,
      filePath TEXT NOT NULL,
      fileHash TEXT,
      fileSize INTEGER,
      width INTEGER,
      height INTEGER,
      dateTaken TEXT,
      gpsLat REAL,
      gpsLon REAL,
      syncStatus TEXT DEFAULT 'not_synced',
      photoId TEXT,
      thumbnailCachePath TEXT,
      lastSyncAttempt TEXT,
      errorMessage TEXT
    );

    CREATE TABLE IF NOT EXISTS thumbnail_cache (
      photoId TEXT PRIMARY KEY,
      localPath TEXT NOT NULL,
      cachedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restore_queue (
      photoId TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      requestedAt TEXT,
      tier TEXT,
      estimatedCompletion TEXT,
      lastPolled TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_device_photos_sync ON device_photos(syncStatus);
    CREATE INDEX IF NOT EXISTS idx_device_photos_hash ON device_photos(fileHash);
  `);
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// === Device Photos ===

export async function insertDevicePhoto(photo: DevicePhoto): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `INSERT OR IGNORE INTO device_photos (localId, filePath, fileHash, fileSize, width, height, dateTaken, gpsLat, gpsLon, syncStatus, photoId, thumbnailCachePath, lastSyncAttempt, errorMessage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [photo.localId, photo.filePath, photo.fileHash, photo.fileSize, photo.width, photo.height, photo.dateTaken, photo.gpsLat, photo.gpsLon, photo.syncStatus, photo.photoId, photo.thumbnailCachePath, photo.lastSyncAttempt, photo.errorMessage]
  );
}

export async function getUnsyncedPhotos(limit: number = 50): Promise<DevicePhoto[]> {
  const d = getDb();
  return d.getAllAsync<DevicePhoto>(
    `SELECT * FROM device_photos WHERE syncStatus = 'not_synced' OR syncStatus = 'failed' ORDER BY dateTaken DESC LIMIT ?`,
    [limit]
  );
}

export async function markAsUploading(localId: string, photoId: string): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `UPDATE device_photos SET syncStatus = 'uploading', photoId = ?, lastSyncAttempt = ? WHERE localId = ?`,
    [photoId, new Date().toISOString(), localId]
  );
}

export async function markAsSynced(localId: string): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `UPDATE device_photos SET syncStatus = 'synced', lastSyncAttempt = ? WHERE localId = ?`,
    [new Date().toISOString(), localId]
  );
}

export async function markAsFailed(localId: string, error: string): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `UPDATE device_photos SET syncStatus = 'failed', errorMessage = ?, lastSyncAttempt = ? WHERE localId = ?`,
    [error, new Date().toISOString(), localId]
  );
}

export async function getPhotoByHash(hash: string): Promise<DevicePhoto | null> {
  const d = getDb();
  return d.getFirstAsync<DevicePhoto>(
    `SELECT * FROM device_photos WHERE fileHash = ? LIMIT 1`,
    [hash]
  );
}

export async function getDevicePhotoCount(): Promise<number> {
  const d = getDb();
  const result = await d.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM device_photos');
  return result?.count ?? 0;
}

export async function getSyncedCount(): Promise<number> {
  const d = getDb();
  const result = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM device_photos WHERE syncStatus = 'synced'`
  );
  return result?.count ?? 0;
}

export async function setThumbnailCachePath(localId: string, path: string): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `UPDATE device_photos SET thumbnailCachePath = ? WHERE localId = ?`,
    [path, localId]
  );
}

export async function devicePhotoExists(localId: string): Promise<boolean> {
  const d = getDb();
  const result = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM device_photos WHERE localId = ?`,
    [localId]
  );
  return (result?.count ?? 0) > 0;
}

// === Thumbnail Cache ===

export async function insertThumbnailCache(entry: ThumbnailCacheEntry): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO thumbnail_cache (photoId, localPath, cachedAt) VALUES (?, ?, ?)`,
    [entry.photoId, entry.localPath, entry.cachedAt]
  );
}

export async function getCachedThumbnail(photoId: string): Promise<ThumbnailCacheEntry | null> {
  const d = getDb();
  return d.getFirstAsync<ThumbnailCacheEntry>(
    `SELECT * FROM thumbnail_cache WHERE photoId = ?`,
    [photoId]
  );
}

export async function clearThumbnailCache(): Promise<void> {
  const d = getDb();
  await d.runAsync('DELETE FROM thumbnail_cache');
}

// === Restore Queue ===

export async function insertRestoreRequest(item: RestoreQueueItem): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO restore_queue (photoId, status, requestedAt, tier, estimatedCompletion, lastPolled) VALUES (?, ?, ?, ?, ?, ?)`,
    [item.photoId, item.status, item.requestedAt, item.tier, item.estimatedCompletion, item.lastPolled]
  );
}

export async function getActiveRestores(): Promise<RestoreQueueItem[]> {
  const d = getDb();
  return d.getAllAsync<RestoreQueueItem>(
    `SELECT * FROM restore_queue WHERE status = 'restoring' OR status = 'restored' ORDER BY requestedAt DESC`
  );
}

export async function updateRestoreStatus(photoId: string, status: string): Promise<void> {
  const d = getDb();
  await d.runAsync(
    `UPDATE restore_queue SET status = ?, lastPolled = ? WHERE photoId = ?`,
    [status, new Date().toISOString(), photoId]
  );
}

export async function getRestoringCount(): Promise<number> {
  const d = getDb();
  const result = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM restore_queue WHERE status = 'restoring'`
  );
  return result?.count ?? 0;
}

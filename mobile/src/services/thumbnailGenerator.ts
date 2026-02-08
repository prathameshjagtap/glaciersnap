// src/services/thumbnailGenerator.ts

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as localDb from '../database/localDb';

const THUMBNAIL_DIR = `${FileSystem.cacheDirectory}thumbnails/`;

// Ensure the thumbnail directory exists
async function ensureThumbnailDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(THUMBNAIL_DIR, { intermediates: true });
  }
}

export async function generateThumbnail(
  photoUri: string,
  localId: string
): Promise<string> {
  await ensureThumbnailDir();

  // Expo SDK 52+ chainable API
  const image = ImageManipulator.manipulate(photoUri);
  const resized = image.resize({ width: 300 }); // Maintains aspect ratio
  const rendered = await resized.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.65,
    format: SaveFormat.JPEG,
  });

  // Move from temp location to our cache directory
  const destPath = `${THUMBNAIL_DIR}${localId}.jpg`;
  await FileSystem.moveAsync({ from: saved.uri, to: destPath });

  // Update local DB with the cached path
  await localDb.setThumbnailCachePath(localId, destPath);

  return destPath;
}

export async function generateThumbnailBatch(
  photos: Array<{ localId: string; filePath: string; thumbnailCachePath: string | null }>,
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  let completed = 0;
  for (const photo of photos) {
    // Skip if already has a cached thumbnail
    if (photo.thumbnailCachePath) {
      const info = await FileSystem.getInfoAsync(photo.thumbnailCachePath);
      if (info.exists) {
        completed++;
        onProgress?.(completed, photos.length);
        continue;
      }
    }

    try {
      await generateThumbnail(photo.filePath, photo.localId);
    } catch (error) {
      // Skip photos that fail to generate thumbnails (corrupted files, unsupported formats)
      console.warn(`Failed to generate thumbnail for ${photo.localId}:`, error);
    }

    completed++;
    onProgress?.(completed, photos.length);
  }
}

export async function getThumbnailCacheSize(): Promise<number> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_DIR);
    if (!dirInfo.exists) return 0;
    const files = await FileSystem.readDirectoryAsync(THUMBNAIL_DIR);
    let total = 0;
    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${THUMBNAIL_DIR}${file}`);
      if (info.exists && 'size' in info && info.size) total += info.size;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function clearThumbnailCacheFiles(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(THUMBNAIL_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(THUMBNAIL_DIR, { idempotent: true });
    }
  } catch {
    // Ignore errors during cleanup
  }
}

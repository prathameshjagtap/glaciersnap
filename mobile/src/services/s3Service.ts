// src/services/s3Service.ts

import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  RestoreObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as FileSystem from 'expo-file-system/legacy';
import { getS3Client } from './awsClients';
import config from '../config/aws-config';
import { RestoreHeaderInfo } from '../types';
import { parseRestoreHeader } from '../utils/dateHelpers';

function getExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/webp': 'webp',
  };
  return map[contentType] ?? 'jpg';
}

export async function uploadOriginal(
  identityId: string,
  photoId: string,
  fileUri: string,
  contentType: string
): Promise<string> {
  const s3 = getS3Client();
  const ext = getExtension(contentType);
  const key = `${identityId}/${photoId}/original.${ext}`;

  // Read file as base64, then convert to Uint8Array
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3_originals_bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    })
  );

  return key;
}

export async function uploadThumbnail(
  identityId: string,
  photoId: string,
  thumbnailUri: string
): Promise<string> {
  const s3 = getS3Client();
  const key = `${identityId}/${photoId}/thumb.jpg`;

  const base64 = await FileSystem.readAsStringAsync(thumbnailUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: config.s3_thumbnails_bucket,
      Key: key,
      Body: bytes,
      ContentType: 'image/jpeg',
    })
  );

  return key;
}

export async function downloadThumbnail(
  identityId: string,
  photoId: string,
  savePath: string
): Promise<void> {
  const s3 = getS3Client();
  const key = `${identityId}/${photoId}/thumb.jpg`;

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: config.s3_thumbnails_bucket,
      Key: key,
    })
  );

  if (response.Body) {
    const bytes = await response.Body.transformToByteArray();
    // Chunked base64 conversion to avoid stack overflow on large files
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.slice(i, i + CHUNK_SIZE));
    }
    const base64 = btoa(binary);
    await FileSystem.writeAsStringAsync(savePath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

export async function getOriginalHead(
  originalKey: string
): Promise<{ storageClass: string | undefined; restore: RestoreHeaderInfo }> {
  const s3 = getS3Client();

  const response = await s3.send(
    new HeadObjectCommand({
      Bucket: config.s3_originals_bucket,
      Key: originalKey,
    })
  );

  return {
    storageClass: response.StorageClass,
    restore: parseRestoreHeader(response.Restore),
  };
}

export async function downloadOriginal(
  originalKey: string,
  savePath: string
): Promise<void> {
  const s3 = getS3Client();

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: config.s3_originals_bucket,
      Key: originalKey,
    })
  );

  if (response.Body) {
    const bytes = await response.Body.transformToByteArray();
    // Chunked base64 conversion — same pattern as downloadThumbnail
    const CHUNK_SIZE = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      binary += String.fromCharCode(...bytes.slice(i, i + CHUNK_SIZE));
    }
    const base64 = btoa(binary);
    await FileSystem.writeAsStringAsync(savePath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

export async function restoreOriginal(
  originalKey: string,
  tier: 'Bulk' | 'Standard'
): Promise<void> {
  const s3 = getS3Client();

  await s3.send(
    new RestoreObjectCommand({
      Bucket: config.s3_originals_bucket,
      Key: originalKey,
      RestoreRequest: {
        Days: 1,
        GlacierJobParameters: { Tier: tier },
      },
    })
  );
}

export async function deleteFromS3(
  identityId: string,
  photoId: string,
  ext: string
): Promise<void> {
  const s3 = getS3Client();

  await Promise.all([
    s3.send(
      new DeleteObjectCommand({
        Bucket: config.s3_originals_bucket,
        Key: `${identityId}/${photoId}/original.${ext}`,
      })
    ),
    s3.send(
      new DeleteObjectCommand({
        Bucket: config.s3_thumbnails_bucket,
        Key: `${identityId}/${photoId}/thumb.jpg`,
      })
    ),
  ]);
}

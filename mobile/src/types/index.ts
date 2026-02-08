// src/types/index.ts

// === AWS Config ===
export interface AWSConfig {
  aws_region: string;
  cognito_user_pool_id: string;
  cognito_client_id: string;
  cognito_identity_pool_id: string;
  s3_originals_bucket: string;
  s3_thumbnails_bucket: string;
  dynamodb_table: string;
}

// === Auth ===
export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  email: string;
  identityId: string; // Cognito Identity Pool ID — used as userId everywhere
}

// === Photo Metadata (DynamoDB record) ===
export interface PhotoRecord {
  userId: string;
  photoId: string;
  originalKey: string;
  thumbnailKey: string;
  fileName: string;
  contentType: string;
  fileHash: string;
  fileSize: number;
  width: number;
  height: number;
  dateTaken: string; // ISO 8601
  gpsLat: number | null;
  gpsLon: number | null;
  uploadStatus: 'uploading' | 'complete' | 'failed';
  restoreStatus: 'none' | 'restoring' | 'restored' | 'archived';
  restoreRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// === Device Photo (local SQLite) ===
export interface DevicePhoto {
  localId: string;
  filePath: string;
  fileHash: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  dateTaken: string | null;
  gpsLat: number | null;
  gpsLon: number | null;
  syncStatus: 'not_synced' | 'uploading' | 'synced' | 'failed';
  photoId: string | null;
  thumbnailCachePath: string | null;
  lastSyncAttempt: string | null;
  errorMessage: string | null;
}

// === Restore Queue (local SQLite) ===
export interface RestoreQueueItem {
  photoId: string;
  status: 'restoring' | 'restored' | 'expired';
  requestedAt: string | null;
  tier: 'Bulk' | 'Standard' | null;
  estimatedCompletion: string | null;
  lastPolled: string | null;
}

// === Thumbnail Cache (local SQLite) ===
export interface ThumbnailCacheEntry {
  photoId: string;
  localPath: string;
  cachedAt: string;
}

// === Restore Header Parsing ===
export interface RestoreHeaderInfo {
  isRestoring: boolean; // ongoing-request="true"
  isRestored: boolean;  // ongoing-request="false"
}

// === Gallery Pagination ===
export interface GalleryPage {
  photos: PhotoRecord[];
  cursor: Record<string, any> | undefined; // DynamoDB LastEvaluatedKey
  hasMore: boolean;
}

// === Upload Queue Item ===
export interface UploadQueueItem {
  localId: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  width: number;
  height: number;
  dateTaken: string;
  gpsLat: number | null;
  gpsLon: number | null;
  fileName: string;
  contentType: string;
  thumbnailUri: string;
  retryCount: number;
}

// === Navigation ===
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  Verify: { email: string };
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Gallery: undefined;
  Restores: undefined;
  Settings: undefined;
};

export type GalleryStackParamList = {
  GalleryGrid: undefined;
  ImageViewer: { photoId: string; photo: PhotoRecord };
};

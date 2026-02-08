// src/components/SyncProgressBar.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSyncStore } from '../stores/syncStore';

export default function SyncProgressBar() {
  const { isScanning, scannedCount, totalDevicePhotos, isSyncing, syncedCount, totalToSync } =
    useSyncStore();

  if (!isScanning && !isSyncing) return null;

  const label = isScanning
    ? `Scanning photos... ${scannedCount} of ${totalDevicePhotos}`
    : `Uploading... ${syncedCount} of ${totalToSync}`;

  const progress = isScanning
    ? totalDevicePhotos > 0
      ? scannedCount / totalDevicePhotos
      : 0
    : totalToSync > 0
    ? syncedCount / totalToSync
    : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f7ff',
    borderBottomWidth: 1,
    borderBottomColor: '#dbeafe',
  },
  label: {
    fontSize: 13,
    color: '#2563eb',
    marginBottom: 4,
  },
  track: {
    height: 4,
    backgroundColor: '#dbeafe',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
});

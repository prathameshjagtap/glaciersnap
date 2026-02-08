// src/screens/SettingsScreen.tsx

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { getIdentityIdSync } from '../services/credentialManager';
import * as dynamoService from '../services/dynamoService';
import { formatBytes } from '../utils/formatBytes';
import { getThumbnailCacheSize, clearThumbnailCacheFiles } from '../services/thumbnailGenerator';
import * as localDb from '../database/localDb';

const WIFI_ONLY_KEY = 'glaciersnap_wifi_only';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  const [stats, setStats] = useState<{ totalSize: number; photoCount: number } | null>(null);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
    loadCacheSize();
  }, []);

  const loadSettings = async () => {
    const stored = await AsyncStorage.getItem(WIFI_ONLY_KEY);
    setWifiOnly(stored === 'true');
  };

  const loadStats = async () => {
    const identityId = getIdentityIdSync();
    if (!identityId) return;

    setLoadingStats(true);
    try {
      const result = await dynamoService.queryAllPhotosForStats(identityId);
      setStats(result);
    } catch {
      // Stats unavailable
    } finally {
      setLoadingStats(false);
    }
  };

  const loadCacheSize = async () => {
    const size = await getThumbnailCacheSize();
    setCacheSize(size);
  };

  const handleWifiToggle = async (value: boolean) => {
    setWifiOnly(value);
    await AsyncStorage.setItem(WIFI_ONLY_KEY, value.toString());
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearThumbnailCacheFiles();
      await localDb.clearThumbnailCache();
      setCacheSize(0);
    } catch {
      Alert.alert('Error', 'Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || 'Unknown'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Identity ID</Text>
          <Text style={styles.valueSmall} numberOfLines={1}>
            {user?.identityId ? user.identityId.substring(0, 24) + '...' : 'Unknown'}
          </Text>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>
        {loadingStats ? (
          <ActivityIndicator style={styles.loadingIndicator} />
        ) : stats ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Photos synced</Text>
              <Text style={styles.value}>{stats.photoCount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Total storage</Text>
              <Text style={styles.value}>{formatBytes(stats.totalSize)}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.unavailable}>Stats unavailable</Text>
        )}
      </View>

      {/* Sync Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.switchRow}>
          <Text style={styles.label}>WiFi only</Text>
          <Switch value={wifiOnly} onValueChange={handleWifiToggle} />
        </View>
      </View>

      {/* Cache Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cache</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Thumbnail cache</Text>
          <Text style={styles.value}>{formatBytes(cacheSize)}</Text>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearCache}
          disabled={clearingCache}
        >
          <Text style={styles.clearButtonText}>
            {clearingCache ? 'Clearing...' : 'Clear Cache'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>GlacierSnap v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  value: {
    fontSize: 15,
    color: '#888',
  },
  valueSmall: {
    fontSize: 12,
    color: '#888',
    maxWidth: 200,
  },
  unavailable: {
    fontSize: 14,
    color: '#ccc',
    paddingVertical: 8,
  },
  loadingIndicator: {
    paddingVertical: 12,
  },
  clearButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  signOutButton: {
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  signOutText: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#ccc',
  },
});

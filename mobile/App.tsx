// App.tsx

// Polyfill crypto for React Native
import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/authStore';
import { initDatabase } from './src/database/localDb';
import { startRestorePolling, stopRestorePolling } from './src/services/restorePoller';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tryAutoLogin = useAuthStore((s) => s.tryAutoLogin);

  useEffect(() => {
    async function init() {
      await initDatabase();
      await tryAutoLogin();
      setIsReady(true);
    }
    init();
  }, []);

  // Start restore polling when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      startRestorePolling();
    } else {
      stopRestorePolling();
    }
    return () => stopRestorePolling();
  }, [isAuthenticated]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

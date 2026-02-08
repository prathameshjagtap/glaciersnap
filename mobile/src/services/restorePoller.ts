// src/services/restorePoller.ts

import { AppState, AppStateStatus, NativeEventSubscription } from 'react-native';
import { useRestoreStore } from '../stores/restoreStore';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let pollTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

export function startRestorePolling(): void {
  if (pollTimer) return;

  // Poll immediately on start
  useRestoreStore.getState().pollAllRestores();

  // Then poll every 15 minutes
  pollTimer = setInterval(() => {
    useRestoreStore.getState().pollAllRestores();
  }, POLL_INTERVAL_MS);

  // Also poll when app comes to foreground
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
}

export function stopRestorePolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    useRestoreStore.getState().pollAllRestores();
  }
}

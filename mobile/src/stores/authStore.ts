// src/stores/authStore.ts

import { create } from 'zustand';
import { AuthUser } from '../types';
import * as credentialManager from '../services/credentialManager';
import { initializeClients, destroyClients } from '../services/awsClients';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  tryAutoLogin: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  signUp: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await credentialManager.signUp(email, password);
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Sign up failed' });
      throw e;
    }
  },

  confirmSignUp: async (email, code) => {
    set({ isLoading: true, error: null });
    try {
      await credentialManager.confirmSignUp(email, code);
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Verification failed' });
      throw e;
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await credentialManager.signIn(email, password);
      initializeClients();
      const identityId = credentialManager.getIdentityIdSync();
      set({
        user: { email, identityId: identityId ?? '' },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Sign in failed' });
      throw e;
    }
  },

  forgotPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await credentialManager.forgotPassword(email);
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Failed to send reset code' });
      throw e;
    }
  },

  confirmForgotPassword: async (email, code, newPassword) => {
    set({ isLoading: true, error: null });
    try {
      await credentialManager.confirmForgotPassword(email, code, newPassword);
      set({ isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.message || 'Password reset failed' });
      throw e;
    }
  },

  signOut: async () => {
    await credentialManager.signOut();
    destroyClients();
    set({ user: null, isAuthenticated: false, error: null });
  },

  tryAutoLogin: async () => {
    set({ isLoading: true });
    try {
      const success = await credentialManager.tryAutoLogin();
      if (success) {
        initializeClients();
        const identityId = credentialManager.getIdentityIdSync();
        set({
          user: { email: '', identityId: identityId ?? '' },
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

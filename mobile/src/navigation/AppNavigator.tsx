// src/navigation/AppNavigator.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../stores/authStore';
import { useRestoreStore } from '../stores/restoreStore';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import RestoreQueueScreen from '../screens/RestoreQueueScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { RootStackParamList, GalleryStackParamList, MainTabParamList } from '../types';

const AuthStack = createNativeStackNavigator<RootStackParamList>();
const GalleryStack = createNativeStackNavigator<GalleryStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="Verify" component={VerifyScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function GalleryNavigator() {
  return (
    <GalleryStack.Navigator>
      <GalleryStack.Screen
        name="GalleryGrid"
        component={GalleryScreen}
        options={{ title: 'GlacierSnap' }}
      />
      <GalleryStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </GalleryStack.Navigator>
  );
}

function MainNavigator() {
  const restoringCount = useRestoreStore((s) => s.restoringCount);

  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Gallery"
        component={GalleryNavigator}
        options={{ headerShown: false, tabBarLabel: 'Photos' }}
      />
      <Tab.Screen
        name="Restores"
        component={RestoreQueueScreen}
        options={{
          tabBarLabel: 'Restores',
          tabBarBadge: restoringCount > 0 ? restoringCount : undefined,
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

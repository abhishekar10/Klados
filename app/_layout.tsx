import '../global.css';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { rem, useColorScheme } from 'nativewind';

import { useDatabaseMigrations } from '../db/migrator';
import { useSettingsStore } from '../store/settings';
import { Toast } from '../components/Toast';

// NativeWind's own default rem base, captured once before any scaling is ever applied — every
// rem-based utility class (text size, padding, gap, radius) resolves against this reactively.
const BASE_REM = rem.get();

export default function RootLayout() {
  const { success, error } = useDatabaseMigrations();
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    if (success) loadSettings();
  }, [success, loadSettings]);

  useEffect(() => {
    if (settings) setColorScheme(settings.theme);
  }, [settings, setColorScheme]);

  useEffect(() => {
    if (settings) rem.set(BASE_REM * settings.fontScale);
  }, [settings]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-red-600">Database migration failed: {error.message}</Text>
      </View>
    );
  }

  if (!success || !settings) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Drill-down navigation slides directionally (forward = in, back = out) per brief §8.4. */}
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      <Toast />
    </SafeAreaProvider>
  );
}

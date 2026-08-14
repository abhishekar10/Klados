import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatePresence, MotiView } from 'moti';

import { useToastStore } from '../store/toast';

const DISPLAY_MS = 2200;

/** In-app notification banner (not an Android notification) — mounted once in app/_layout.tsx. */
export function Toast() {
  const toast = useToastStore((s) => s.toast);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(hide, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [toast, hide]);

  return (
    <AnimatePresence>
      {toast && (
        <MotiView
          key={toast.id}
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          exit={{ opacity: 0, translateY: 16 }}
          transition={{ type: 'timing', duration: 200 }}
          pointerEvents="none"
          style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, alignItems: 'center' }}
        >
          <View className="rounded-full bg-neutral-900 px-4 py-2.5 dark:bg-neutral-100">
            <Text className="text-sm font-medium text-white dark:text-neutral-900">{toast.message}</Text>
          </View>
        </MotiView>
      )}
    </AnimatePresence>
  );
}

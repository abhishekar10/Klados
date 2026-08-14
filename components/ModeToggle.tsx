import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

/** Top-bar Drill-down/Outline switch (brief §8.2) — both read the same underlying data. */
export function ModeToggle({ mode }: { mode: 'drilldown' | 'outline' }) {
  const router = useRouter();

  return (
    <View className="flex-row overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
      <Pressable onPress={() => router.push('/explorer')} className={mode === 'drilldown' ? 'bg-neutral-900 px-3.5 py-2 dark:bg-neutral-100' : 'px-3.5 py-2'}>
        <Text className={mode === 'drilldown' ? 'text-sm font-medium text-white dark:text-neutral-900' : 'text-sm font-medium text-neutral-500'}>
          Tree
        </Text>
      </Pressable>
      <Pressable onPress={() => router.push('/outline')} className={mode === 'outline' ? 'bg-neutral-900 px-3.5 py-2 dark:bg-neutral-100' : 'px-3.5 py-2'}>
        <Text className={mode === 'outline' ? 'text-sm font-medium text-white dark:text-neutral-900' : 'text-sm font-medium text-neutral-500'}>
          Outline
        </Text>
      </Pressable>
    </View>
  );
}

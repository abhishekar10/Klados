import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markRecurringCompleteToday, toggleLeafComplete } from '../lib/goals';
import { getTodaysSurfacedGoals, type SurfacedGoal } from '../lib/home';
import { useSettingsStore } from '../store/settings';
import { CompletionCheckbox } from '../components/CompletionCheckbox';

const REASON_LABEL: Record<SurfacedGoal['reason'], string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  'recurring-today': 'Today',
  fallback: '',
};

/**
 * Home/Welcome (brief §8.3/§6) — greeting, the daily-surfacing "today's tasks" list (capped
 * ~5, brief §6's priority order), and a CTA into the explorer. Reloads whenever Home regains
 * focus (e.g. navigating back from completing something in the Explorer).
 */
export default function Home() {
  const router = useRouter();
  const dueSoonHours = useSettingsStore((s) => s.settings?.dueSoonHours ?? 2);
  const checkboxColor = useSettingsStore((s) => s.settings?.checkboxColor ?? '#65a30d');
  const [tasks, setTasks] = useState<SurfacedGoal[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setTasks(await getTodaysSurfacedGoals({ dueSoonHours }));
  }, [dueSoonHours]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleToggle = async (item: SurfacedGoal) => {
    if (item.goal.scheduleType === 'recurring') {
      // A checklist habit can have several members due today — one checkbox tap can't say
      // which one(s), so send the user to Node Detail's per-member list instead of guessing.
      // (Blindly calling markRecurringCompleteToday here would also write a rotation-shaped
      // completion_log row that collides with checklist mode's per-child rows for this date.)
      if (item.goal.recurringMode === 'checklist') {
        router.push(`/explorer/${item.goal.id}`);
        return;
      }
      await markRecurringCompleteToday(item.goal.id, true);
    } else {
      await toggleLeafComplete(item.goal.id, true);
    }
    reload();
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="items-center px-6 pb-4 pt-10">
        <Text className="mb-2 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Klados</Text>
        <Text className="text-center text-base text-neutral-500">
          Break your goals down until each step is just something you do.
        </Text>
      </View>

      <View className="flex-1 px-4">
        <Text className="mb-2 text-sm font-medium text-neutral-500">Today</Text>
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.goal.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/explorer/${item.goal.id}`)}
              className="flex-row items-center gap-3 border-b border-neutral-200 py-3 dark:border-neutral-800"
            >
              <CompletionCheckbox isComplete={false} onToggle={() => handleToggle(item)} color={checkboxColor} />
              <View className="flex-1">
                <Text className="text-base text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
                  {item.goal.title}
                </Text>
                {(item.goal.timeOfDay || REASON_LABEL[item.reason]) && (
                  <Text className="text-xs text-neutral-500">
                    {[item.goal.timeOfDay, REASON_LABEL[item.reason]].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <Text className="py-6 text-center text-sm text-neutral-400">Nothing due today.</Text>
          }
        />
      </View>

      <View className="items-center px-6 pb-10 pt-4">
        <Pressable
          onPress={() => router.push('/explorer')}
          className="rounded-full bg-neutral-900 px-8 py-4 dark:bg-neutral-100"
        >
          <Text className="text-base font-medium text-white dark:text-neutral-900">Get me there</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

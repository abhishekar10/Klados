import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { withAlpha } from '../lib/colorPalette';
import { toDateKey } from '../lib/cycles';
import { getChecklistDayFractions, getCompletionLogRange, type CompletionLogRow } from '../lib/completionLog';
import { getGoal, type Goal } from '../lib/goals';
import { bucketIntensity } from '../lib/streakIntensity';
import { useSettingsStore } from '../store/settings';

const WEEKS_SHOWN = 17;
const CELL_SIZE = 12;
const CELL_GAP = 3;

/** GitHub-contributions-style heatmap sourced from completion_log (brief §8.3). */
export function StreakCalendarScreen({ goalId }: { goalId: string }) {
  const router = useRouter();
  const calendarColor = useSettingsStore((s) => s.settings?.calendarColor ?? '#0891b2');
  const [goal, setGoal] = useState<Goal | null | undefined>(undefined);
  const [log, setLog] = useState<CompletionLogRow[]>([]);
  const [dayFractions, setDayFractions] = useState<Map<string, number>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const g = await getGoal(goalId);
    setGoal(g ?? null);
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (WEEKS_SHOWN * 7 - 1));
    const startKey = toDateKey(start);
    const endKey = toDateKey(today);
    if (g?.recurringMode === 'checklist') {
      setDayFractions(await getChecklistDayFractions(goalId, (g.cyclePattern ?? []).length, startKey, endKey));
      setLog([]);
    } else {
      setLog(await getCompletionLogRange(goalId, startKey, endKey));
      setDayFractions(new Map());
    }
  }, [goalId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const weeks = useMemo(() => {
    const today = new Date();
    const days: Date[] = [];
    for (let i = WEEKS_SHOWN * 7 - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d);
    }
    const chunks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
    return chunks;
  }, []);

  const completedDates = useMemo(() => new Set(log.filter((l) => l.completed).map((l) => l.date)), [log]);
  const loggedDates = useMemo(() => new Set(log.map((l) => l.date)), [log]);
  const isChecklist = goal?.recurringMode === 'checklist';

  if (goal === undefined) return null;

  const noDataColor = 'transparent';
  const intensityColor = {
    none: noDataColor,
    low: withAlpha(calendarColor, 0.3),
    medium: withAlpha(calendarColor, 0.65),
    high: calendarColor,
  } as const;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1.5">
          <Text className="text-base text-neutral-500">{'‹ Back'}</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
          {goal ? `${goal.title} — streaks` : 'Streaks'}
        </Text>
      </View>

      {!goal ? (
        <View className="items-center px-4 py-10">
          <Text className="text-neutral-400">This goal no longer exists.</Text>
        </View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          <ScrollView horizontal contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row" style={{ gap: CELL_GAP }}>
              {weeks.map((week, wi) => (
                <View key={wi} style={{ gap: CELL_GAP }}>
                  {week.map((day, di) => {
                    const key = toDateKey(day);
                    if (isChecklist) {
                      const bucket = bucketIntensity(dayFractions.get(key) ?? 0);
                      return (
                        <View
                          key={di}
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            borderRadius: 3,
                            borderWidth: 1,
                            borderColor: 'rgba(163, 163, 163, 0.4)',
                            backgroundColor: intensityColor[bucket],
                          }}
                          className={bucket === 'none' ? 'bg-neutral-200 dark:bg-neutral-800' : ''}
                        />
                      );
                    }
                    const completed = completedDates.has(key);
                    const logged = loggedDates.has(key);
                    return (
                      <View
                        key={di}
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderRadius: 3,
                          borderWidth: 1,
                          borderColor: 'rgba(163, 163, 163, 0.4)',
                          backgroundColor: completed ? calendarColor : logged ? '#f87171' : undefined,
                        }}
                        className={completed || logged ? '' : 'bg-neutral-200 dark:bg-neutral-800'}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="flex-row flex-wrap items-center gap-2 px-4 pb-4">
            {isChecklist ? (
              <>
                <View style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, backgroundColor: intensityColor.low }} />
                <Text className="text-xs text-neutral-500">Low</Text>
                <View style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, backgroundColor: intensityColor.medium }} />
                <Text className="text-xs text-neutral-500">Medium</Text>
                <View style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, backgroundColor: intensityColor.high }} />
                <Text className="text-xs text-neutral-500">High</Text>
                <View
                  className="bg-neutral-200 dark:bg-neutral-800"
                  style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(163, 163, 163, 0.4)' }}
                />
                <Text className="text-xs text-neutral-500">No data</Text>
              </>
            ) : (
              <>
                <View style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, backgroundColor: calendarColor }} />
                <Text className="text-xs text-neutral-500">Completed</Text>
                <View style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, backgroundColor: '#f87171' }} />
                <Text className="text-xs text-neutral-500">Missed</Text>
                <View
                  className="bg-neutral-200 dark:bg-neutral-800"
                  style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(163, 163, 163, 0.4)' }}
                />
                <Text className="text-xs text-neutral-500">No data</Text>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

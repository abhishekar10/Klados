import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { toDateKey } from '../lib/cycles';
import {
  getTodayStatus,
  markChecklistChildCompleteToday,
  markRecurringCompleteToday,
  setDateRange,
  setOneShot,
  setRecurringSchedule,
  setTimeOfDay,
  type Goal,
  type GoalTreeNode,
  type TodayStatus,
} from '../lib/goals';
import type { RecurringMode, ScheduleType } from '../db/schema';
import { useSettingsStore } from '../store/settings';
import { CompletionCheckbox } from './CompletionCheckbox';

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  'one-shot': 'One-shot',
  recurring: 'Recurring',
  'date-range': 'Date-range',
};

const RECURRING_MODE_LABELS: Record<RecurringMode, string> = {
  rotation: 'Rotation',
  checklist: 'Checklist',
};

/**
 * Rejects both malformed strings and calendar overflow (e.g. "2026-02-30") — JS's Date silently
 * normalizes the latter into March, so a naive isNaN check alone would accept it and store a
 * date string that doesn't match what parsing it back out later actually produces.
 */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return toDateKey(parsed) === value;
}

/**
 * Schedule type selector + type-specific fields (brief §8.3): one-shot needs nothing extra
 * (the complete toggle lives in ExplorerScreen itself), recurring gets a cycle-pattern editor
 * plus a "started on" date and a link to the Streak Calendar, date-range gets start/end pickers.
 * Time-of-day is shown regardless — it's an orthogonal tag any node can carry (brief §4).
 */
export function ScheduleEditor({
  goal,
  children,
  onChanged,
}: {
  goal: Goal;
  children: GoalTreeNode[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const checkboxColor = useSettingsStore((s) => s.settings?.checkboxColor ?? '#65a30d');
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [rangeStartDraft, setRangeStartDraft] = useState(goal.rangeStart ?? '');
  const [rangeEndDraft, setRangeEndDraft] = useState(goal.rangeEnd ?? '');
  const [timeDraft, setTimeDraft] = useState(goal.timeOfDay ?? '');

  useEffect(() => {
    setRangeStartDraft(goal.rangeStart ?? '');
    setRangeEndDraft(goal.rangeEnd ?? '');
    setTimeDraft(goal.timeOfDay ?? '');
    if (goal.scheduleType === 'recurring') {
      getTodayStatus(goal.id).then(setTodayStatus);
    } else {
      setTodayStatus(null);
    }
  }, [goal.id, goal.scheduleType, goal.cyclePattern, goal.cycleStartedAt]);

  const handleSelectType = async (type: ScheduleType) => {
    if (type === goal.scheduleType) return;
    if (type === 'one-shot') await setOneShot(goal.id);
    else if (type === 'recurring')
      await setRecurringSchedule(goal.id, { cyclePattern: [], cycleStartedAt: toDateKey(new Date()), recurringMode: 'rotation' });
    else await setDateRange(goal.id, { rangeStart: toDateKey(new Date()), rangeEnd: toDateKey(new Date()) });
    onChanged();
  };

  const cyclePattern = goal.cyclePattern ?? [];
  const recurringMode = goal.recurringMode ?? 'rotation';
  const childTitleById = new Map(children.map((c) => [c.goal.id, c.goal.title]));

  const handleSelectRecurringMode = async (mode: RecurringMode) => {
    if (mode === recurringMode) return;
    await setRecurringSchedule(goal.id, {
      cyclePattern,
      cycleStartedAt: goal.cycleStartedAt ?? toDateKey(new Date()),
      recurringMode: mode,
    });
    onChanged();
  };

  const appendToPattern = async (childId: string) => {
    await setRecurringSchedule(goal.id, {
      cyclePattern: [...cyclePattern, childId],
      cycleStartedAt: goal.cycleStartedAt ?? toDateKey(new Date()),
      recurringMode,
    });
    onChanged();
  };

  const removeFromPattern = async (index: number) => {
    await setRecurringSchedule(goal.id, {
      cyclePattern: cyclePattern.filter((_, i) => i !== index),
      cycleStartedAt: goal.cycleStartedAt ?? toDateKey(new Date()),
      recurringMode,
    });
    onChanged();
  };

  const saveCycleStartedAt = async (value: string) => {
    if (!isValidDate(value)) return;
    await setRecurringSchedule(goal.id, { cyclePattern, cycleStartedAt: value, recurringMode });
    onChanged();
  };

  const saveRangeStart = async () => {
    if (!isValidDate(rangeStartDraft)) return;
    await setDateRange(goal.id, { rangeStart: rangeStartDraft, rangeEnd: goal.rangeEnd ?? rangeStartDraft });
    onChanged();
  };

  const saveRangeEnd = async () => {
    if (!isValidDate(rangeEndDraft)) return;
    await setDateRange(goal.id, { rangeStart: goal.rangeStart ?? rangeEndDraft, rangeEnd: rangeEndDraft });
    onChanged();
  };

  const saveTimeOfDay = async () => {
    const trimmed = timeDraft.trim();
    if (trimmed === '') {
      await setTimeOfDay(goal.id, null);
      onChanged();
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(trimmed)) return;
    await setTimeOfDay(goal.id, trimmed);
    onChanged();
  };

  const handleToggleToday = async () => {
    if (!todayStatus) return;
    await markRecurringCompleteToday(goal.id, !todayStatus.completedToday);
    setTodayStatus(await getTodayStatus(goal.id));
    onChanged();
  };

  const handleToggleChecklistChild = async (childId: string) => {
    if (!todayStatus) return;
    await markChecklistChildCompleteToday(goal.id, childId, !todayStatus.checklistStatus[childId]);
    setTodayStatus(await getTodayStatus(goal.id));
    onChanged();
  };

  return (
    <View className="gap-3">
      <View className="flex-row gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
        {(['one-shot', 'recurring', 'date-range'] as ScheduleType[]).map((type) => {
          const active = type === goal.scheduleType;
          return (
            <Pressable
              key={type}
              onPress={() => handleSelectType(type)}
              className={active ? 'flex-1 items-center rounded-md bg-neutral-900 py-1.5 dark:bg-neutral-100' : 'flex-1 items-center py-1.5'}
            >
              <Text className={active ? 'text-xs font-medium text-white dark:text-neutral-900' : 'text-xs text-neutral-500'}>
                {SCHEDULE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center gap-2">
        <Text className="text-sm text-neutral-500">Time of day</Text>
        <TextInput
          value={timeDraft}
          onChangeText={setTimeDraft}
          onBlur={saveTimeOfDay}
          placeholder="HH:MM"
          placeholderTextColor="#a3a3a3"
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:text-neutral-100"
        />
      </View>

      {goal.scheduleType === 'recurring' && (
        <View className="gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
          <View className="flex-row gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
            {(['rotation', 'checklist'] as RecurringMode[]).map((mode) => {
              const active = mode === recurringMode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => handleSelectRecurringMode(mode)}
                  className={active ? 'flex-1 items-center rounded-md bg-neutral-900 py-1 dark:bg-neutral-100' : 'flex-1 items-center py-1'}
                >
                  <Text className={active ? 'text-xs font-medium text-white dark:text-neutral-900' : 'text-xs text-neutral-500'}>
                    {RECURRING_MODE_LABELS[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {recurringMode === 'rotation' && todayStatus && (
            <Pressable onPress={handleToggleToday} className="flex-row items-center gap-2">
              <CompletionCheckbox isComplete={todayStatus.completedToday} color={checkboxColor} />
              <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                {todayStatus.dueChildId
                  ? `Today: ${childTitleById.get(todayStatus.dueChildId) ?? '…'}`
                  : "Mark today's instance done"}
              </Text>
            </Pressable>
          )}

          {recurringMode === 'checklist' && todayStatus && cyclePattern.length > 0 && (
            <View className="gap-1.5">
              <Text className="text-xs text-neutral-500">Today</Text>
              {cyclePattern.map((childId) => (
                <Pressable
                  key={childId}
                  onPress={() => handleToggleChecklistChild(childId)}
                  className="flex-row items-center gap-2"
                >
                  <CompletionCheckbox
                    isComplete={!!todayStatus.checklistStatus[childId]}
                    color={checkboxColor}
                    className="text-base"
                  />
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300">
                    {childTitleById.get(childId) ?? '…'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {children.length > 0 && (
            <>
              <Text className="text-xs text-neutral-500">
                {recurringMode === 'rotation'
                  ? 'Rotation (tap to add, tap a pill to remove)'
                  : 'Checklist members (tap to add, tap a pill to remove)'}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {cyclePattern.map((childId, i) => (
                  <Pressable
                    key={`${childId}-${i}`}
                    onPress={() => removeFromPattern(i)}
                    className="rounded-full bg-neutral-200 px-3 py-1 dark:bg-neutral-800"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {childTitleById.get(childId) ?? '…'} ✕
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {children
                  .filter((c) => recurringMode === 'rotation' || !cyclePattern.includes(c.goal.id))
                  .map((c) => (
                  <Pressable
                    key={c.goal.id}
                    onPress={() => appendToPattern(c.goal.id)}
                    className="rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-600 dark:text-neutral-400">+ {c.goal.title}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-neutral-500">Started on</Text>
            <TextInput
              defaultValue={goal.cycleStartedAt ?? ''}
              onEndEditing={(e) => saveCycleStartedAt(e.nativeEvent.text)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#a3a3a3"
              className="w-28 rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:text-neutral-100"
            />
          </View>

          <Pressable onPress={() => router.push(`/streaks/${goal.id}`)}>
            <Text className="text-sm font-medium text-blue-600 dark:text-blue-400">View streak calendar →</Text>
          </Pressable>
        </View>
      )}

      {goal.scheduleType === 'date-range' && (
        <View className="gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={rangeStartDraft}
              onChangeText={setRangeStartDraft}
              onBlur={saveRangeStart}
              placeholder="Start YYYY-MM-DD"
              placeholderTextColor="#a3a3a3"
              className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:text-neutral-100"
            />
            <Text className="text-neutral-400">→</Text>
            <TextInput
              value={rangeEndDraft}
              onChangeText={setRangeEndDraft}
              onBlur={saveRangeEnd}
              placeholder="End YYYY-MM-DD"
              placeholderTextColor="#a3a3a3"
              className="flex-1 rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:text-neutral-100"
            />
          </View>

          {children.some((c) => c.goal.rangeStart) && (
            <View className="gap-1 border-t border-neutral-200 pt-2 dark:border-neutral-800">
              <Text className="text-xs text-neutral-500">Sequential windows</Text>
              {[...children]
                .filter((c) => c.goal.rangeStart)
                .sort((a, b) => (a.goal.rangeStart ?? '').localeCompare(b.goal.rangeStart ?? ''))
                .map((c) => (
                  <Text key={c.goal.id} className="text-xs text-neutral-600 dark:text-neutral-400">
                    {c.goal.title}: {c.goal.rangeStart} → {c.goal.rangeEnd ?? '?'}
                  </Text>
                ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

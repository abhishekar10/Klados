import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import type { Goal } from '../lib/goals';
import { CompletionCheckbox } from './CompletionCheckbox';
import { ProgressIndicator } from './indicators/ProgressIndicator';

const CAPTION_ICON_COLOR = '#a3a3a3'; // neutral-400, same tone in light and dark

interface GoalRowProps {
  goal: Goal;
  isLeaf: boolean;
  progress: number;
  childProgresses: number[];
  accentColor: string;
  checkboxColor: string;
  isStale: boolean;
  /** Recurring nodes only — whether today's due instance is already logged. */
  recurringCompletedToday?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPress: () => void;
  /** Leaves: toggles is_complete. Recurring leaves: logs/un-logs today's instance instead — the caller decides which. */
  onToggleComplete: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * File-explorer row (brief §8.1/§8.4): chevron for parents, checkbox for leaves, a small
 * caption row of minimal outline icons below the title (folder for parents, repeat for any
 * recurring node) so a habit reads differently from a one-time task at a glance (brief §8.4)
 * without crowding the title line itself. A recurring *leaf*'s checkbox reflects today's logged
 * instance (recurringCompletedToday), never is_complete — brief §3: recurring nodes have no
 * natural Complete state. A recurring *parent*'s toggle lives in its own Node Detail
 * (ScheduleEditor) instead, since "today's due child" is internal detail.
 */
export function GoalRow({
  goal,
  isLeaf,
  progress,
  childProgresses,
  accentColor,
  checkboxColor,
  isStale,
  recurringCompletedToday,
  canMoveUp,
  canMoveDown,
  onPress,
  onToggleComplete,
  onDelete,
  onMoveUp,
  onMoveDown,
}: GoalRowProps) {
  const isPaused = goal.lifecycleState === 'paused';
  const isRecurring = goal.scheduleType === 'recurring';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 ${
        isPaused ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {isLeaf && (
          <CompletionCheckbox
            isComplete={isRecurring ? !!recurringCompletedToday : goal.isComplete}
            onToggle={onToggleComplete}
            color={checkboxColor}
          />
        )}
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-base text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
              {goal.title}
            </Text>
            {isStale && <View className="h-2 w-2 rounded-full bg-amber-500" />}
          </View>
          {(!isLeaf || isRecurring) && (
            <View className="mt-0.5 flex-row items-center gap-2.5">
              {!isLeaf && <Feather name="folder" size={12} color={CAPTION_ICON_COLOR} />}
              {isRecurring && <Feather name="repeat" size={12} color={CAPTION_ICON_COLOR} />}
            </View>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-4">
        <ProgressIndicator
          progress={progress}
          childProgresses={childProgresses}
          isComplete={goal.isComplete}
          accentColor={accentColor}
        />
        {!isLeaf && <Text className="text-neutral-400">{'›'}</Text>}
        <View className="gap-1">
          <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={10} className="p-1">
            <Text className={canMoveUp ? 'text-sm text-neutral-500' : 'text-sm text-neutral-200 dark:text-neutral-800'}>▲</Text>
          </Pressable>
          <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={10} className="p-1">
            <Text className={canMoveDown ? 'text-sm text-neutral-500' : 'text-sm text-neutral-200 dark:text-neutral-800'}>▼</Text>
          </Pressable>
        </View>
        <Pressable onPress={onDelete} hitSlop={10} className="p-1">
          <Text className="text-sm text-red-500">Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

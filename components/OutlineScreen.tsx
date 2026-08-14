import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import Feather from '@expo/vector-icons/Feather';

import { getTree, markRecurringCompleteToday, toggleLeafComplete, type GoalTreeNode } from '../lib/goals';
import { isStale } from '../lib/staleness';
import { useSettingsStore } from '../store/settings';
import { CompletionCheckbox } from './CompletionCheckbox';
import { ProgressIndicator } from './indicators/ProgressIndicator';
import { ModeToggle } from './ModeToggle';

const INDENT_PER_DEPTH = 20;
const CAPTION_ICON_COLOR = '#a3a3a3'; // neutral-400, same tone in light and dark

function TreeRow({
  node,
  depth,
  accentColor,
  checkboxColor,
  reload,
}: {
  node: GoalTreeNode;
  depth: number;
  accentColor: string;
  checkboxColor: string;
  reload: () => void;
}) {
  const router = useRouter();
  const staleDays = useSettingsStore((s) => s.settings?.staleDays ?? 14);
  const [expanded, setExpanded] = useState(depth === 0);
  const isLeaf = node.children.length === 0;
  const isPaused = node.goal.lifecycleState === 'paused';
  const isRecurring = node.goal.scheduleType === 'recurring';
  const stale = node.goal.lifecycleState === 'active' && isStale(node.lastActivityAt, staleDays, new Date());

  return (
    <View>
      <Pressable
        onPress={() => router.push(`/explorer/${node.goal.id}`)}
        className={`flex-row items-center justify-between border-b border-neutral-200 py-3 pr-4 dark:border-neutral-800 ${
          isPaused ? 'opacity-50' : ''
        }`}
        style={{ paddingLeft: 16 + depth * INDENT_PER_DEPTH }}
      >
        <View className="flex-1 flex-row items-center gap-2">
          {isLeaf ? (
            <CompletionCheckbox
              isComplete={isRecurring ? !!node.recurringCompletedToday : node.goal.isComplete}
              onToggle={async () => {
                if (isRecurring) {
                  await markRecurringCompleteToday(node.goal.id, !node.recurringCompletedToday);
                } else {
                  await toggleLeafComplete(node.goal.id, !node.goal.isComplete);
                }
                reload();
              }}
              color={checkboxColor}
            />
          ) : (
            <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={10} className="p-1.5">
              <MotiView
                animate={{ rotate: expanded ? '90deg' : '0deg' }}
                transition={{ type: 'timing', duration: 150 }}
              >
                <Text className="w-4 text-center text-neutral-400">▸</Text>
              </MotiView>
            </Pressable>
          )}
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-base text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
                {node.goal.title}
              </Text>
              {stale && <View className="h-2 w-2 rounded-full bg-amber-500" />}
            </View>
            {isRecurring && (
              <View className="mt-0.5 flex-row items-center">
                <Feather name="repeat" size={12} color={CAPTION_ICON_COLOR} />
              </View>
            )}
          </View>
        </View>
        <ProgressIndicator
          progress={node.progress}
          childProgresses={node.children.map((c) => c.progress)}
          isComplete={node.goal.isComplete}
          accentColor={accentColor}
        />
      </Pressable>
      {!isLeaf && expanded && (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 150 }}>
          {node.children.map((child) => (
            <TreeRow
              key={child.goal.id}
              node={child}
              depth={depth + 1}
              accentColor={accentColor}
              checkboxColor={checkboxColor}
              reload={reload}
            />
          ))}
        </MotiView>
      )}
    </View>
  );
}

/**
 * Outline mode (brief §8.2): single scrollable screen, every visible node indented by depth,
 * chevron expands/collapses in place. Reads the same data as the Drill-down explorer — no
 * separate storage, no reload-on-switch beyond a normal screen mount.
 */
export function OutlineScreen() {
  const router = useRouter();
  const showArchived = useSettingsStore((s) => s.settings?.showArchived ?? false);
  const progressColor = useSettingsStore((s) => s.settings?.progressColor ?? '#2563eb');
  const checkboxColor = useSettingsStore((s) => s.settings?.checkboxColor ?? '#65a30d');
  const [tree, setTree] = useState<GoalTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setTree(await getTree(null, { includeArchived: showArchived }));
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-sm font-medium text-neutral-500">Klados</Text>
        <View className="flex-row items-center gap-3">
          <ModeToggle mode="outline" />
          <Pressable onPress={() => router.push('/search')} hitSlop={10} className="p-1.5">
            <Text className="text-lg">🔍</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} className="p-1.5">
            <Text className="text-lg">⚙️</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-400">Loading…</Text>
        </View>
      ) : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
          {tree.length === 0 ? (
            <View className="items-center px-4 py-10">
              <Text className="text-neutral-400">No goals yet.</Text>
            </View>
          ) : (
            tree.map((node) => (
              <TreeRow
                key={node.goal.id}
                node={node}
                depth={0}
                accentColor={progressColor}
                checkboxColor={checkboxColor}
                reload={reload}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getTree, moveGoal, type GoalTreeNode } from '../lib/goals';

const INDENT_PER_DEPTH = 20;

function PickRow({
  node,
  depth,
  onPick,
}: {
  node: GoalTreeNode;
  depth: number;
  onPick: (parentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <View>
      <View className="flex-row items-center border-b border-neutral-200 py-3 pr-4 dark:border-neutral-800" style={{ paddingLeft: 16 + depth * INDENT_PER_DEPTH }}>
        {hasChildren ? (
          <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8} className="w-6">
            <Text className="text-center text-neutral-400">{expanded ? '▾' : '▸'}</Text>
          </Pressable>
        ) : (
          <View className="w-6" />
        )}
        <Pressable onPress={() => onPick(node.goal.id)} className="flex-1">
          <Text className="text-base text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
            {node.goal.title}
          </Text>
        </Pressable>
      </View>
      {hasChildren && expanded && node.children.map((child) => <PickRow key={child.goal.id} node={child} depth={depth + 1} onPick={onPick} />)}
    </View>
  );
}

/** Picker for brief §8.3's "move-to-different-parent" Node Detail action. */
export function MovePickerScreen({ movingId }: { movingId: string }) {
  const router = useRouter();
  const [tree, setTree] = useState<GoalTreeNode[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setTree(await getTree(null));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handlePick = async (newParentId: string | null) => {
    try {
      await moveGoal(movingId, newParentId);
      router.replace(`/explorer/${movingId}`);
    } catch (err) {
      Alert.alert('Can’t move here', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1.5">
          <Text className="text-base text-neutral-500">Cancel</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Move to…</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
        <Pressable onPress={() => handlePick(null)} className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Text className="text-base font-medium text-neutral-900 dark:text-neutral-100">Klados (root level)</Text>
        </Pressable>
        {tree.map((node) => (
          <PickRow key={node.goal.id} node={node} depth={0} onPick={handlePick} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

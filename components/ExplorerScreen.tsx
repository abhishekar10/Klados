import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToastStore } from '../store/toast';
import {
  computeSubtreeProgress,
  createGoal,
  deleteGoal,
  getAncestorChain,
  getGoal,
  getTree,
  listChildren,
  markRecurringCompleteToday,
  reorderSibling,
  setLifecycleState,
  toggleLeafComplete,
  updateGoal,
  type Goal,
  type GoalTreeNode,
} from '../lib/goals';
import { isStale } from '../lib/staleness';
import { useSettingsStore } from '../store/settings';
import { CompletionCheckbox } from './CompletionCheckbox';
import { GoalRow } from './GoalRow';
import { ProgressIndicator } from './indicators/ProgressIndicator';
import { ModeToggle } from './ModeToggle';
import { ScheduleEditor } from './ScheduleEditor';

/**
 * Drill-down explorer (brief §8.3). currentId === null is the root level (just a children
 * list — there's no single "root" node to show fields for). For any other node, this screen
 * doubles as Node Detail (brief §8.3 lists a children list as part of Node Detail itself):
 * editable title/description, a complete toggle when it's currently a leaf, lifecycle actions,
 * move-to-different-parent, and — critically — the same "add a child here" bar as any other
 * level, so a brand-new node (which starts out looking like a leaf, since it has no children
 * yet) can still be drilled into and grown into a parent.
 */
export function ExplorerScreen({ currentId }: { currentId: string | null }) {
  const router = useRouter();
  const showArchived = useSettingsStore((s) => s.settings?.showArchived ?? false);
  const staleDays = useSettingsStore((s) => s.settings?.staleDays ?? 14);
  const progressColor = useSettingsStore((s) => s.settings?.progressColor ?? '#2563eb');
  const checkboxColor = useSettingsStore((s) => s.settings?.checkboxColor ?? '#65a30d');
  const [self, setSelf] = useState<Goal | null | undefined>(undefined); // undefined = loading, null = root
  const [selfProgress, setSelfProgress] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<Goal[]>([]);
  const [tree, setTree] = useState<GoalTreeNode[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useToastStore((s) => s.show);

  const reload = useCallback(async () => {
    const [selfGoal, crumb, kids, progress] = await Promise.all([
      currentId ? getGoal(currentId) : Promise.resolve(null),
      currentId ? getAncestorChain(currentId) : Promise.resolve([]),
      getTree(currentId, { includeArchived: showArchived }),
      // Deliberately independent of the showArchived-filtered `kids` above — see
      // computeSubtreeProgress's doc comment: a display toggle shouldn't change the number.
      currentId ? computeSubtreeProgress(currentId) : Promise.resolve(0),
    ]);
    setSelf(selfGoal ?? null);
    if (selfGoal) {
      setTitleDraft(selfGoal.title);
      setDescriptionDraft(selfGoal.description ?? '');
    }
    setBreadcrumb(crumb);
    setTree(kids);
    setSelfProgress(progress);
    setLoading(false);
  }, [currentId, showArchived]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    // Count *all* siblings, not just the currently-displayed (showArchived-filtered) ones —
    // otherwise a new goal's sortOrder could collide with a hidden archived sibling's.
    const allSiblings = await listChildren(currentId, { includeArchived: true });
    await createGoal({ parentId: currentId, title, sortOrder: allSiblings.length });
    setNewTitle('');
    reload();
  };

  const handleToggleChild = async (entry: GoalTreeNode) => {
    if (entry.goal.scheduleType === 'recurring') {
      await markRecurringCompleteToday(entry.goal.id, !entry.recurringCompletedToday);
    } else {
      await toggleLeafComplete(entry.goal.id, !entry.goal.isComplete);
    }
    reload();
  };

  const handleReorder = async (goalId: string, direction: 'up' | 'down') => {
    await reorderSibling(goalId, direction, { includeArchived: showArchived });
    reload();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleDeleteChild = (entry: GoalTreeNode) => {
    const message =
      entry.children.length > 0
        ? `"${entry.goal.title}" has ${entry.children.length} child goal(s). Deleting it deletes the entire subtree. This can't be undone.`
        : `Delete "${entry.goal.title}"? This can't be undone.`;
    Alert.alert('Delete goal', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(entry.goal.id);
          reload();
        },
      },
    ]);
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!self || !title || title === self.title) return;
    await updateGoal(self.id, { title });
    reload();
  };

  const saveDescription = async () => {
    if (!self) return;
    const description = descriptionDraft.trim() || null;
    if (description === (self.description ?? null)) return;
    await updateGoal(self.id, { description });
    reload();
  };

  // Fields already autosave on blur — this forces any field still focused (so not yet
  // blurred/committed) to commit now, and gives the user an explicit, visible confirmation.
  const handleSave = () => {
    Keyboard.dismiss();
    showToast('Saved');
  };

  const handleToggleSelfComplete = async () => {
    if (!self) return;
    await toggleLeafComplete(self.id, !self.isComplete);
    reload();
  };

  const handleSetState = async (state: 'active' | 'paused' | 'archived') => {
    if (!self) return;
    await setLifecycleState(self.id, state);
    reload();
  };

  const handleDeleteSelf = () => {
    if (!self) return;
    const message =
      tree.length > 0
        ? `"${self.title}" has ${tree.length} child goal(s). Deleting it deletes the entire subtree. This can't be undone.`
        : `Delete "${self.title}"? This can't be undone.`;
    Alert.alert('Delete goal', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteGoal(self.id);
          router.back();
        },
      },
    ]);
  };

  if (loading || self === undefined) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-neutral-950">
        <Text className="text-neutral-400">Loading…</Text>
      </SafeAreaView>
    );
  }

  if (currentId && self === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6 dark:bg-neutral-950">
        <Text className="text-neutral-400">This goal no longer exists.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-1 flex-row flex-wrap items-center gap-1">
          <Pressable onPress={() => router.push('/explorer')}>
            <Text className="text-sm font-medium text-neutral-500">Klados</Text>
          </Pressable>
          {breadcrumb.map((node) => (
            <View key={node.id} className="flex-row items-center gap-1">
              <Text className="text-sm text-neutral-400">/</Text>
              <Pressable onPress={() => router.push(`/explorer/${node.id}`)}>
                <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{node.title}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View className="flex-row items-center gap-3">
          <ModeToggle mode="drilldown" />
          <Pressable onPress={() => router.push('/search')} hitSlop={10} className="p-1.5">
            <Text className="text-lg">🔍</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} className="p-1.5">
            <Text className="text-lg">⚙️</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <TextInput
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="Add a goal at this level…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-base dark:border-neutral-700 dark:text-neutral-100"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <Pressable onPress={handleAdd} className="rounded-lg bg-neutral-900 px-5 py-2.5 dark:bg-neutral-100">
          <Text className="font-medium text-white dark:text-neutral-900">Add</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <FlatList
        data={tree}
        keyExtractor={(entry) => entry.goal.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          self ? (
            <View className="gap-3 border-b border-neutral-200 px-4 pb-4 dark:border-neutral-800">
              <View className="flex-row items-center gap-3">
                <ProgressIndicator
                  progress={selfProgress}
                  childProgresses={tree.map((c) => c.progress)}
                  isComplete={self.isComplete}
                  accentColor={progressColor}
                  size="large"
                />
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  onBlur={saveTitle}
                  onSubmitEditing={saveTitle}
                  editable={self.lifecycleState !== 'archived'}
                  className="flex-1 text-xl font-semibold text-neutral-900 dark:text-neutral-100"
                  placeholder="Title"
                />
              </View>
              <TextInput
                value={descriptionDraft}
                onChangeText={setDescriptionDraft}
                onBlur={saveDescription}
                editable={self.lifecycleState !== 'archived'}
                multiline
                placeholder="Add a description…"
                placeholderTextColor="#a3a3a3"
                className="min-h-[40px] text-base text-neutral-600 dark:text-neutral-400"
              />

              {self.lifecycleState === 'archived' ? (
                <Text className="text-sm text-neutral-400">
                  Archived · {self.isComplete ? 'was completed' : 'was not completed'}
                </Text>
              ) : (
                <>
                  <ScheduleEditor goal={self} children={tree} onChanged={reload} />

                  {self.scheduleType !== 'recurring' && tree.length === 0 && (
                    <Pressable onPress={handleToggleSelfComplete} className="flex-row items-center gap-2">
                      <CompletionCheckbox isComplete={self.isComplete} color={checkboxColor} />
                      <Text className="text-base text-neutral-700 dark:text-neutral-300">
                        {self.isComplete ? 'Completed' : 'Mark complete'}
                      </Text>
                    </Pressable>
                  )}

                  <View className="flex-row flex-wrap gap-2.5">
                    <Pressable onPress={handleSave} className="rounded-full bg-neutral-900 px-4 py-2 dark:bg-neutral-100">
                      <Text className="text-sm font-medium text-white dark:text-neutral-900">Save</Text>
                    </Pressable>
                    {self.lifecycleState === 'active' && (
                      <Pressable onPress={() => handleSetState('paused')} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">
                        <Text className="text-sm text-neutral-600 dark:text-neutral-400">Pause</Text>
                      </Pressable>
                    )}
                    {self.lifecycleState === 'paused' && (
                      <>
                        <Pressable onPress={() => handleSetState('active')} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">
                          <Text className="text-sm text-neutral-600 dark:text-neutral-400">Resume</Text>
                        </Pressable>
                        <Pressable onPress={() => handleSetState('archived')} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">
                          <Text className="text-sm text-neutral-600 dark:text-neutral-400">Archive</Text>
                        </Pressable>
                      </>
                    )}
                    {self.lifecycleState === 'complete' && (
                      <Pressable onPress={() => handleSetState('archived')} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">
                        <Text className="text-sm text-neutral-600 dark:text-neutral-400">Archive</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => router.push(`/move/${self.id}`)} className="rounded-full border border-neutral-300 px-4 py-2 dark:border-neutral-700">
                      <Text className="text-sm text-neutral-600 dark:text-neutral-400">Move</Text>
                    </Pressable>
                    <Pressable onPress={handleDeleteSelf} className="rounded-full border border-red-300 px-4 py-2">
                      <Text className="text-sm text-red-500">Delete this goal</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <GoalRow
            goal={item.goal}
            isLeaf={item.children.length === 0}
            progress={item.progress}
            childProgresses={item.children.map((c) => c.progress)}
            accentColor={progressColor}
            checkboxColor={checkboxColor}
            isStale={item.goal.lifecycleState === 'active' && isStale(item.lastActivityAt, staleDays, new Date())}
            recurringCompletedToday={item.recurringCompletedToday}
            canMoveUp={index > 0}
            canMoveDown={index < tree.length - 1}
            onPress={() => router.push(`/explorer/${item.goal.id}`)}
            onToggleComplete={() => handleToggleChild(item)}
            onDelete={() => handleDeleteChild(item)}
            onMoveUp={() => handleReorder(item.goal.id, 'up')}
            onMoveDown={() => handleReorder(item.goal.id, 'down')}
          />
        )}
        ListEmptyComponent={
          <View className="items-center px-4 py-10">
            <Text className="text-neutral-400">No goals here yet.</Text>
          </View>
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

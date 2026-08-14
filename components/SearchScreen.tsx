import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAncestorChain, searchGoals, type Goal } from '../lib/goals';

interface SearchResult {
  goal: Goal;
  path: string;
}

/** Brief §10 Phase 2's "search/filter across the tree." */
export function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const matches = await searchGoals(q);
    const withPaths = await Promise.all(
      matches.map(async (goal): Promise<SearchResult> => {
        const chain = await getAncestorChain(goal.id);
        const path = chain.slice(0, -1).map((c) => c.title).join(' / ');
        return { goal, path: path || 'Klados (root level)' };
      }),
    );
    return withPaths;
  }, []);

  useEffect(() => {
    let cancelled = false;
    runSearch(query).then((withPaths) => {
      if (!cancelled) setResults(withPaths);
    });
    return () => {
      cancelled = true;
    };
  }, [query, runSearch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setResults(await runSearch(query));
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1.5">
          <Text className="text-base text-neutral-500">{'‹ Back'}</Text>
        </Pressable>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Search goals…"
          placeholderTextColor="#a3a3a3"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-base dark:border-neutral-700 dark:text-neutral-100"
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.goal.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/explorer/${item.goal.id}`)}
            className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800"
          >
            <Text className="text-base text-neutral-900 dark:text-neutral-100" numberOfLines={1}>
              {item.goal.title}
            </Text>
            <Text className="text-xs text-neutral-500" numberOfLines={1}>
              {item.path}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          query.trim() ? (
            <View className="items-center px-4 py-10">
              <Text className="text-neutral-400">No matches.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

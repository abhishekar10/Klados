import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLOR_PALETTE } from '../lib/colorPalette';
import { useSettingsStore } from '../store/settings';
import { FONT_SCALE_STEPS, type FontScale, type IndicatorStyle, type ThemeOption } from '../db/schema';

const FONT_SCALE_LABELS: Record<FontScale, string> = {
  0.85: 'Small',
  1: 'Default',
  1.15: 'Large',
  1.3: 'Extra Large',
};

function ColorSwatchPicker({ current, onSelect }: { current: string; onSelect: (color: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {COLOR_PALETTE.map((color) => (
        <Pressable
          key={color}
          onPress={() => onSelect(color)}
          className={`h-8 w-8 items-center justify-center rounded-full ${
            current === color ? 'border-2 border-neutral-900 dark:border-neutral-100' : ''
          }`}
          style={{ backgroundColor: color }}
          hitSlop={4}
        >
          {current === color && <Text className="text-xs text-white">✓</Text>}
        </Pressable>
      ))}
    </View>
  );
}

function SegmentedOption<T>({
  value,
  current,
  label,
  onSelect,
}: {
  value: T;
  current: T;
  label: string;
  onSelect: (value: T) => void;
}) {
  const active = value === current;
  return (
    <Pressable
      onPress={() => onSelect(value)}
      className={active ? 'flex-1 items-center rounded-lg bg-neutral-900 py-2 dark:bg-neutral-100' : 'flex-1 items-center py-2'}
    >
      <Text className={active ? 'text-sm font-medium text-white dark:text-neutral-900' : 'text-sm text-neutral-500'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <Text className="text-sm font-medium text-neutral-500">{title}</Text>
      {children}
    </View>
  );
}

/** Settings (brief §8.3): theme, progress-indicator style, show-archived, staleness/due-soon thresholds. */
export function SettingsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  if (!settings) return null;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-950" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1.5">
          <Text className="text-base text-neutral-500">{'‹ Back'}</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Settings</Text>
      </View>

      <ScrollView>
        <Section title="Theme">
          <View className="flex-row gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
            {(['system', 'light', 'dark'] as ThemeOption[]).map((option) => (
              <SegmentedOption
                key={option}
                value={option}
                current={settings.theme}
                label={option[0].toUpperCase() + option.slice(1)}
                onSelect={(theme) => setSettings({ theme })}
              />
            ))}
          </View>
        </Section>

        <Section title="Text size">
          <View className="flex-row gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
            {FONT_SCALE_STEPS.map((option) => (
              <SegmentedOption
                key={option}
                value={option}
                current={settings.fontScale as FontScale}
                label={FONT_SCALE_LABELS[option]}
                onSelect={(fontScale) => setSettings({ fontScale })}
              />
            ))}
          </View>
        </Section>

        <Section title="Progress indicator">
          <View className="flex-row gap-1 rounded-lg border border-neutral-300 p-1 dark:border-neutral-700">
            {(['ring', 'battery'] as IndicatorStyle[]).map((option) => (
              <SegmentedOption
                key={option}
                value={option}
                current={settings.indicatorStyle}
                label={option === 'ring' ? 'Segmented ring' : '3D battery'}
                onSelect={(indicatorStyle) => setSettings({ indicatorStyle })}
              />
            ))}
          </View>
        </Section>

        <Section title="Colors">
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">Progress bar / ring</Text>
            <ColorSwatchPicker
              current={settings.progressColor}
              onSelect={(progressColor) => setSettings({ progressColor })}
            />
          </View>
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">Streak calendar</Text>
            <ColorSwatchPicker
              current={settings.calendarColor}
              onSelect={(calendarColor) => setSettings({ calendarColor })}
            />
          </View>
          <View className="gap-1">
            <Text className="text-sm text-neutral-500">Checkbox</Text>
            <ColorSwatchPicker
              current={settings.checkboxColor}
              onSelect={(checkboxColor) => setSettings({ checkboxColor })}
            />
          </View>
        </Section>

        <Section title="Archived goals">
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">Show archived goals</Text>
            <Switch value={settings.showArchived} onValueChange={(showArchived) => setSettings({ showArchived })} />
          </View>
        </Section>

        <Section title="Staleness">
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">Flag inactive after (days)</Text>
            <TextInput
              value={String(settings.staleDays)}
              onChangeText={(text) => {
                const staleDays = parseInt(text, 10);
                if (!Number.isNaN(staleDays) && staleDays > 0) setSettings({ staleDays });
              }}
              keyboardType="number-pad"
              className="w-16 rounded-lg border border-neutral-300 px-3 py-1 text-right text-base dark:border-neutral-700 dark:text-neutral-100"
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-base text-neutral-700 dark:text-neutral-300">"Due soon" window (hours)</Text>
            <TextInput
              value={String(settings.dueSoonHours)}
              onChangeText={(text) => {
                const dueSoonHours = parseInt(text, 10);
                if (!Number.isNaN(dueSoonHours) && dueSoonHours > 0) setSettings({ dueSoonHours });
              }}
              keyboardType="number-pad"
              className="w-16 rounded-lg border border-neutral-300 px-3 py-1 text-right text-base dark:border-neutral-700 dark:text-neutral-100"
            />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

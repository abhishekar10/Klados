import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * "3D battery" progress indicator (brief §8.5, variant 2): a horizontal capsule with a
 * skeuomorphic bevel/gradient — the deliberate richness spot contrasting with the otherwise
 * flat/minimal base UI (brief §8.1). Fills left-to-right, percentage numeral inside the bar.
 */
export function BatteryBar({
  progress,
  accentColor,
  width = 64,
  height = 22,
}: {
  progress: number;
  accentColor: string;
  width?: number;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = height / 2;

  return (
    <View
      style={{ width, height, borderRadius: radius }}
      className="overflow-hidden border border-black/10 bg-neutral-200 dark:border-white/10 dark:bg-neutral-800"
    >
      {/* Bevel: a subtle top-to-bottom light gradient over the whole capsule track. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height / 2 }}
      />
      <View style={{ width: `${clamped}%`, height: '100%' }}>
        <LinearGradient
          colors={[lighten(accentColor), accentColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      <View className="absolute inset-0 items-center justify-center">
        <Text
          style={{ fontSize: Math.max(9, height * 0.5) }}
          className="font-semibold text-neutral-900 dark:text-white"
        >
          {Math.round(clamped)}%
        </Text>
      </View>
    </View>
  );
}

function lighten(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + 40);
  const g = Math.min(255, ((num >> 8) & 0xff) + 40);
  const b = Math.min(255, (num & 0xff) + 40);
  return `rgb(${r}, ${g}, ${b})`;
}

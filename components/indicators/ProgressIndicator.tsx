import { useSettingsStore } from '../../store/settings';
import { BatteryBar } from './BatteryBar';
import { SegmentedRing } from './SegmentedRing';

/** Settings-driven switch between the two progress indicator variants (brief §8.5). */
export function ProgressIndicator({
  progress,
  childProgresses,
  isComplete,
  accentColor,
  size = 'small',
}: {
  progress: number;
  childProgresses: number[];
  isComplete: boolean;
  accentColor: string;
  size?: 'small' | 'large';
}) {
  const indicatorStyle = useSettingsStore((s) => s.settings?.indicatorStyle ?? 'ring');

  if (indicatorStyle === 'battery') {
    return (
      <BatteryBar
        progress={progress}
        accentColor={accentColor}
        width={size === 'large' ? 120 : 64}
        height={size === 'large' ? 32 : 22}
      />
    );
  }

  return (
    <SegmentedRing
      childProgresses={childProgresses}
      isComplete={isComplete}
      accentColor={accentColor}
      size={size === 'large' ? 64 : 28}
    />
  );
}

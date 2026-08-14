import { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { MotiView } from 'moti';

/**
 * The ☐/☑ glyph, used identically wherever a leaf's completion is toggled or shown. Completing
 * (false→true only, not the reverse) gets a small reward pulse per brief §8.4 — "a moment of
 * reward — allowed a bit of flourish."
 */
export function CompletionCheckbox({
  isComplete,
  onToggle,
  className = 'text-lg',
  color,
}: {
  isComplete: boolean;
  onToggle?: () => void;
  className?: string;
  /** Applied to the glyph only once complete — the accent-color user setting (unchecked stays neutral). */
  color?: string;
}) {
  const wasComplete = useRef(isComplete);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (isComplete && !wasComplete.current) {
      setPulseKey((k) => k + 1);
    }
    wasComplete.current = isComplete;
  }, [isComplete]);

  const glyph = (
    <MotiView
      key={pulseKey}
      from={{ scale: pulseKey > 0 ? 1.6 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 7, mass: 0.5 }}
    >
      <Text
        className={isComplete ? className : `${className} text-neutral-900 dark:text-neutral-100`}
        style={isComplete && color ? { color } : undefined}
      >
        {isComplete ? '☑' : '☐'}
      </Text>
    </MotiView>
  );

  if (!onToggle) return glyph;
  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      {glyph}
    </Pressable>
  );
}

import Svg, { Circle, Path } from 'react-native-svg';

import { computeRingSegments, describeArc } from './geometry';

const TRACK_COLOR = '#e5e5e5';
const TRACK_COLOR_DARK = '#404040';

/**
 * "Sliced cake" progress indicator (brief §8.5, variant 1): as many wedges as immediate
 * children, each sized as an equal share and filled to that specific child's own progress.
 * Leaf nodes (no children) fall back to a single simple ring, filled 0% or 100%.
 */
export function SegmentedRing({
  childProgresses,
  isComplete = false,
  size = 28,
  accentColor,
  dark = false,
}: {
  childProgresses: number[];
  isComplete?: boolean;
  size?: number;
  accentColor: string;
  dark?: boolean;
}) {
  const strokeWidth = Math.max(2, size * 0.14);
  const r = size / 2 - strokeWidth / 2;
  const cx = size / 2;
  const cy = size / 2;
  const track = dark ? TRACK_COLOR_DARK : TRACK_COLOR;

  if (childProgresses.length === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={isComplete ? accentColor : track} strokeWidth={strokeWidth} fill="none" />
      </Svg>
    );
  }

  const segments = computeRingSegments(childProgresses);

  return (
    <Svg width={size} height={size}>
      {segments.map((segment, i) => (
        <Path
          key={`track-${i}`}
          d={describeArc(cx, cy, r, segment.trackStart, segment.trackEnd)}
          stroke={track}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {segments.map(
        (segment, i) =>
          segment.fillEnd > segment.trackStart && (
            <Path
              key={`fill-${i}`}
              d={describeArc(cx, cy, r, segment.trackStart, segment.fillEnd)}
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          ),
      )}
    </Svg>
  );
}

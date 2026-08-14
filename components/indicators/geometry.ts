/** Shared polar-to-SVG-arc math for SegmentedRing — pure, unit-testable independent of RN/SVG. */
export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180; // 0deg = 12 o'clock, increasing clockwise
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

/** SVG path `d` for a clockwise arc from startAngle to endAngle (degrees, 0 = 12 o'clock). */
export function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  if (endAngle <= startAngle) return '';
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export interface RingSegment {
  trackStart: number;
  trackEnd: number;
  fillEnd: number;
}

/**
 * Divides a full circle into `count` equal wedges with a small gap between them (brief §8.5:
 * "segment boundaries are smooth/rounded, not sharp spokes" — a gap + round linecaps is what
 * makes a boundary read as two rounded arc-ends rather than a hard radial line), each wedge's
 * fill proportional to that child's own progress (0-100).
 */
export function computeRingSegments(childProgresses: number[]): RingSegment[] {
  const count = childProgresses.length;
  if (count === 0) return [];
  const span = 360 / count;
  const gap = Math.min(6, span * 0.2);
  return childProgresses.map((progress, i) => {
    const trackStart = i * span + gap / 2;
    const trackEnd = (i + 1) * span - gap / 2;
    const clamped = Math.max(0, Math.min(100, progress));
    return { trackStart, trackEnd, fillEnd: trackStart + (trackEnd - trackStart) * (clamped / 100) };
  });
}

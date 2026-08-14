import { computeRingSegments } from '../geometry';

describe('computeRingSegments', () => {
  test('4 children split into 4 equal-span wedges tiling the full circle (brief §8.5)', () => {
    const segments = computeRingSegments([100, 100, 0, 0]);
    expect(segments).toHaveLength(4);
    const spans = segments.map((s) => s.trackEnd - s.trackStart);
    spans.forEach((span) => expect(span).toBeCloseTo(spans[0], 5));
    // First wedge starts just after 0° and the last ends just before 360° — the small gap
    // at the very start/end is the wedges' own half-gap margin, not a missing chunk of circle.
    expect(segments[0].trackStart).toBeGreaterThan(0);
    expect(segments[0].trackStart).toBeLessThan(10);
    expect(segments[3].trackEnd).toBeGreaterThan(350);
    expect(segments[3].trackEnd).toBeLessThan(360);
  });

  test('a wedge fills proportionally to that child\'s own progress', () => {
    const [full, half, empty] = computeRingSegments([100, 50, 0]);
    expect(full.fillEnd).toBeCloseTo(full.trackEnd, 5);
    expect(half.fillEnd).toBeCloseTo((half.trackStart + half.trackEnd) / 2, 5);
    expect(empty.fillEnd).toBeCloseTo(empty.trackStart, 5);
  });

  test('no children yields no segments', () => {
    expect(computeRingSegments([])).toEqual([]);
  });
});

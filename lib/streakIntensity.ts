export type StreakIntensity = 'none' | 'low' | 'medium' | 'high';

/**
 * Buckets a checklist day's checked-fraction (0-1) for the streak calendar's 3-tier intensity
 * coloring: <25% checked = low, <75% = medium, >=75% = high. The 75% boundary itself reads as
 * high (closing the gap the user's ">75%"/"<75%" phrasing left open, on the reading that a
 * common fraction like exactly 3-of-4 shouldn't fall through uncolored).
 */
export function bucketIntensity(fractionChecked: number): StreakIntensity {
  if (fractionChecked <= 0) return 'none';
  if (fractionChecked < 0.25) return 'low';
  if (fractionChecked < 0.75) return 'medium';
  return 'high';
}

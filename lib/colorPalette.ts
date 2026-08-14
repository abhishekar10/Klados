/** Shared swatch options for the three global accent-color pickers in Settings. */
export const COLOR_PALETTE = [
  '#2563eb', // azure blue
  '#16a34a', // green
  '#d97706', // amber
  '#db2777', // pink
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#65a30d', // olive
] as const;

/**
 * Applies alpha to a "#rrggbb" hex color, for the streak calendar's graduated intensity —
 * derived from the user's own calendarColor setting rather than a hardcoded green, so the
 * gradient always matches whatever color the user picked.
 */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

import { isStale } from '../staleness';

describe('isStale', () => {
  const now = new Date('2026-08-14T12:00:00');

  test('not stale exactly at the threshold', () => {
    const lastActivity = new Date('2026-07-31T12:00:00'); // exactly 14 days ago
    expect(isStale(lastActivity, 14, now)).toBe(false);
  });

  test('stale just past the threshold', () => {
    const lastActivity = new Date('2026-07-30T11:00:00'); // just over 14 days ago
    expect(isStale(lastActivity, 14, now)).toBe(true);
  });

  test('recent activity is never stale', () => {
    const lastActivity = new Date('2026-08-13T12:00:00');
    expect(isStale(lastActivity, 14, now)).toBe(false);
  });

  test('threshold is tunable', () => {
    const lastActivity = new Date('2026-08-10T12:00:00'); // 4 days ago
    expect(isStale(lastActivity, 3, now)).toBe(true);
    expect(isStale(lastActivity, 5, now)).toBe(false);
  });
});

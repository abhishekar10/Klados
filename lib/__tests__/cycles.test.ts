import { daysSince, getDueChildId, toDateKey } from '../cycles';

describe('daysSince', () => {
  test('is 0 the day the cycle starts', () => {
    expect(daysSince('2026-08-14', new Date('2026-08-14T18:00:00'))).toBe(0);
  });

  test('counts whole calendar days regardless of time-of-day', () => {
    expect(daysSince('2026-08-14', new Date('2026-08-15T00:01:00'))).toBe(1);
    expect(daysSince('2026-08-14', new Date('2026-08-18T23:59:00'))).toBe(4);
  });
});

describe('getDueChildId', () => {
  const pattern = ['gym', 'gym', 'gym', 'swim'];

  test("brief §4's worked example: [Gym, Gym, Gym, Swimming] repeating every 4 days", () => {
    expect(getDueChildId(pattern, '2026-08-01', new Date('2026-08-01'))).toBe('gym'); // day 0
    expect(getDueChildId(pattern, '2026-08-01', new Date('2026-08-02'))).toBe('gym'); // day 1
    expect(getDueChildId(pattern, '2026-08-01', new Date('2026-08-03'))).toBe('gym'); // day 2
    expect(getDueChildId(pattern, '2026-08-01', new Date('2026-08-04'))).toBe('swim'); // day 3
    expect(getDueChildId(pattern, '2026-08-01', new Date('2026-08-05'))).toBe('gym'); // day 4 — cycle repeats
  });

  test('cycle starting today is day 0', () => {
    const today = new Date('2026-08-14');
    expect(getDueChildId(pattern, '2026-08-14', today)).toBe('gym');
  });

  test('an empty pattern has no due child', () => {
    expect(getDueChildId([], '2026-08-01', new Date('2026-08-05'))).toBeNull();
  });
});

describe('toDateKey', () => {
  test('formats as local YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 7, 4))).toBe('2026-08-04'); // month is 0-indexed
  });
});

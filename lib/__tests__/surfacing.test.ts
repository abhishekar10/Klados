import { surfaceTodaysTasks, type SurfacingCandidate } from '../surfacing';

const NOW = new Date('2026-08-14T06:20:00'); // brief §6's own worked time

function candidate(overrides: Partial<SurfacingCandidate> & { id: string }): SurfacingCandidate {
  return {
    lifecycleState: 'active',
    scheduleType: 'one-shot',
    timeOfDay: null,
    isComplete: false,
    isLeaf: true,
    recurringDoneToday: false,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('surfaceTodaysTasks', () => {
  test("brief §6's worked example: overdue 6:15am task shows first at 6:20am", () => {
    const freshenUp = candidate({ id: 'freshen-up', timeOfDay: '06:15' });
    const wakeUp = candidate({ id: 'wake-up', timeOfDay: '05:30' }); // overdue longer
    const result = surfaceTodaysTasks([wakeUp, freshenUp], NOW);
    expect(result[0].id).toBe('freshen-up'); // soonest-passed-first
    expect(result[0].reason).toBe('overdue');
    expect(result[1].id).toBe('wake-up');
  });

  test('due-soon tasks are ordered ascending by time', () => {
    const later = candidate({ id: 'later', timeOfDay: '07:30' });
    const sooner = candidate({ id: 'sooner', timeOfDay: '06:45' });
    const result = surfaceTodaysTasks([later, sooner], NOW, { dueSoonHours: 2 });
    expect(result.map((r) => r.id)).toEqual(['sooner', 'later']);
    expect(result[0].reason).toBe('due-soon');
  });

  test('overdue ranks above due-soon, which ranks above untimed recurring, which ranks above fallback', () => {
    const overdue = candidate({ id: 'overdue', timeOfDay: '06:00' });
    const dueSoon = candidate({ id: 'due-soon', timeOfDay: '07:00' });
    const recurring = candidate({ id: 'recurring', scheduleType: 'recurring', recurringDoneToday: false });
    const fallback = candidate({ id: 'fallback', updatedAt: new Date('2026-08-01') });
    const result = surfaceTodaysTasks([fallback, recurring, dueSoon, overdue], NOW);
    expect(result.map((r) => r.id)).toEqual(['overdue', 'due-soon', 'recurring', 'fallback']);
  });

  test('fallback fill is most-recently-touched first', () => {
    const older = candidate({ id: 'older', updatedAt: new Date('2026-08-01') });
    const newer = candidate({ id: 'newer', updatedAt: new Date('2026-08-13') });
    const result = surfaceTodaysTasks([older, newer], NOW);
    expect(result.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  test('paused and archived nodes never appear, regardless of timing', () => {
    const paused = candidate({ id: 'paused', lifecycleState: 'paused', timeOfDay: '06:00' });
    const archived = candidate({ id: 'archived', lifecycleState: 'archived', timeOfDay: '06:00' });
    const result = surfaceTodaysTasks([paused, archived], NOW);
    expect(result).toEqual([]);
  });

  test('completed one-shot leaves and logged recurring instances do not surface', () => {
    const doneOneShot = candidate({ id: 'done', timeOfDay: '06:00', isComplete: true });
    const doneRecurring = candidate({ id: 'done-recurring', scheduleType: 'recurring', recurringDoneToday: true });
    const result = surfaceTodaysTasks([doneOneShot, doneRecurring], NOW);
    expect(result).toEqual([]);
  });

  test('one-shot parent nodes are excluded even if tagged with a time', () => {
    const parent = candidate({ id: 'parent', timeOfDay: '06:00', isLeaf: false });
    const result = surfaceTodaysTasks([parent], NOW);
    expect(result).toEqual([]);
  });

  test('caps at the configured limit (default 5)', () => {
    const many = Array.from({ length: 10 }, (_, i) => candidate({ id: `t${i}`, updatedAt: new Date(2026, 7, i) }));
    expect(surfaceTodaysTasks(many, NOW)).toHaveLength(5);
    expect(surfaceTodaysTasks(many, NOW, { cap: 3 })).toHaveLength(3);
  });
});

import { computeProgress, type ProgressNode } from '../rollup';

function leaf(id: string, isComplete: boolean): ProgressNode {
  return { id, isComplete, children: [] };
}

describe('computeProgress', () => {
  test('an incomplete leaf is 0%', () => {
    expect(computeProgress(leaf('a', false))).toBe(0);
  });

  test('a complete leaf is 100%', () => {
    expect(computeProgress(leaf('a', true))).toBe(100);
  });

  test('a parent with 4 leaves, 2 complete, is 50%', () => {
    const node: ProgressNode = {
      id: 'child-with-4-grandchildren',
      isComplete: false,
      children: [leaf('g1', true), leaf('g2', true), leaf('g3', false), leaf('g4', false)],
    };
    expect(computeProgress(node)).toBe(50);
  });

  test("brief §2 worked example: (50% + 0%) / 2 = 25%", () => {
    const childA: ProgressNode = {
      id: 'child-a',
      isComplete: false,
      children: [leaf('g1', true), leaf('g2', true), leaf('g3', false), leaf('g4', false)],
    };
    const childB: ProgressNode = {
      id: 'child-b',
      isComplete: false,
      children: [leaf('g5', false), leaf('g6', false), leaf('g7', false), leaf('g8', false)],
    };
    const root: ProgressNode = { id: 'root', isComplete: false, children: [childA, childB] };

    expect(computeProgress(childA)).toBe(50);
    expect(computeProgress(childB)).toBe(0);
    expect(computeProgress(root)).toBe(25);
  });

  test('depth is unbounded — a 4-level chain rolls up correctly', () => {
    const greatGrandchild = leaf('gg', true);
    const grandchild: ProgressNode = { id: 'g', isComplete: false, children: [greatGrandchild] };
    const child: ProgressNode = { id: 'c', isComplete: false, children: [grandchild] };
    const root: ProgressNode = { id: 'r', isComplete: false, children: [child] };
    expect(computeProgress(root)).toBe(100);
  });

  test('a recurring node reports its trailing-window override instead of averaging children', () => {
    const node: ProgressNode = {
      id: 'fitness',
      isComplete: false,
      children: [leaf('irrelevant', false)],
      recurringProgressOverride: 73,
    };
    expect(computeProgress(node)).toBe(73);
  });
});

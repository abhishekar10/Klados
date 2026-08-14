/**
 * Progress roll-up algorithm — PROJECT-BRIEF.md §2.
 *
 * Pure and tree-shaped on purpose (no React, no SQLite import) so it's cheap to unit-test
 * in isolation — see lib/__tests__/rollup.test.ts, which checks it against the brief's own
 * worked example (25%).
 */
export interface ProgressNode {
  id: string;
  /** Meaningful only for leaves (no children) — ignored otherwise. */
  isComplete: boolean;
  children: ProgressNode[];
  /**
   * Phase 1.5: a recurring node's contribution to its parent's average is its trailing-window
   * completion rate (brief §2 amendment), not the binary/averaged value below. MVP never sets
   * this (schedule_type stays 'one-shot'), but the field exists now so Phase 1.5 doesn't need
   * to change this function's shape — only start populating it.
   */
  recurringProgressOverride?: number;
}

/** 0-100. Recurses depth-first; O(subtree size) for a full recompute from an arbitrary node. */
export function computeProgress(node: ProgressNode): number {
  if (node.recurringProgressOverride !== undefined) {
    return node.recurringProgressOverride;
  }
  if (node.children.length === 0) {
    return node.isComplete ? 100 : 0;
  }
  const sum = node.children.reduce((acc, child) => acc + computeProgress(child), 0);
  return sum / node.children.length;
}

// Brought in from the upstream OSS fix for the same feature:
//   nocodb/nocodb#14058 — "fix(gui): defer relation field updates until save in
//   expanded form" by Aakash Gautam (@aakashgautam-git).
// Pure, framework-agnostic helpers for the expanded form's deferred relation
// (LTAR) editing — kept side-effect free so they can be unit tested in isolation
// (see test/ltar-deferred-ops.test.ts).

import type { RelationTypes } from 'nocodb-sdk'

/**
 * A single link/unlink operation queued by the expanded form while editing an
 * existing record. Instead of writing to the backend immediately, relation edits
 * are buffered as these ops and replayed on Save — see #14013 and
 * `useExpandedFormStore.save()` / `useLTARStore.link()/unlink()`.
 *
 * Every field needed to replay the nested API call is captured at enqueue time so
 * the op is self-contained (no dependency on live store state at Save time).
 */
export interface PendingLtarOp {
  op: 'link' | 'unlink'
  columnId: string
  baseId: string
  tableId: string
  rowId: string
  type: RelationTypes
  relatedRowId: string
  /** Related record object — used only to re-render single-target chips optimistically. */
  record: Record<string, any>
}

/**
 * Merge a new link/unlink operation into the pending queue (mutates `queue`).
 *
 * Reconciliation rules, so that multiple edits before Save collapse to the
 * minimal, correct set of API calls:
 *  - Applying the inverse op on the same record cancels the queued op (net no-op,
 *    e.g. unlink → re-link of the same record, or link → unlink before saving).
 *  - A duplicate of an already-queued op is ignored.
 *  - Otherwise the op is appended. Insertion order is preserved so that on replay
 *    removals run before additions of later picks.
 *
 * Returns the same `queue` reference for convenience.
 */
export function reconcilePendingLtarOp(queue: PendingLtarOp[], next: PendingLtarOp): PendingLtarOp[] {
  const inverse = next.op === 'link' ? 'unlink' : 'link'

  const inverseIdx = queue.findIndex(
    (o) => o.op === inverse && o.columnId === next.columnId && o.relatedRowId === next.relatedRowId,
  )
  if (inverseIdx !== -1) {
    queue.splice(inverseIdx, 1)
    return queue
  }

  const isDuplicate = queue.some((o) => o.op === next.op && o.columnId === next.columnId && o.relatedRowId === next.relatedRowId)
  if (!isDuplicate) queue.push(next)

  return queue
}

/**
 * Optimistic rollup count for a multi-target (HM/MM) column:
 * original linked count − queued unlinks + queued links (never below 0).
 */
export function resolveDeferredLtarCount(queue: PendingLtarOp[], columnId: string, originalCount: number): number {
  const ops = queue.filter((o) => o.columnId === columnId)
  const links = ops.filter((o) => o.op === 'link').length
  const unlinks = ops.filter((o) => o.op === 'unlink').length
  return Math.max(0, (Number(originalCount) || 0) - unlinks + links)
}

/**
 * Optimistic value for a single-target (BT/OO/MO) column:
 *  - the latest queued link wins (a replace),
 *  - else a queued unlink clears it,
 *  - else fall back to the original server value.
 */
export function resolveDeferredSingleTargetValue(
  queue: PendingLtarOp[],
  columnId: string,
  originalValue: Record<string, any> | null,
): Record<string, any> | null {
  const ops = queue.filter((o) => o.columnId === columnId)
  const lastLink = ops.findLast((o) => o.op === 'link')
  if (lastLink) return lastLink.record
  if (ops.some((o) => o.op === 'unlink')) return null
  return originalValue ?? null
}

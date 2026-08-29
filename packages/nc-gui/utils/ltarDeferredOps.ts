// Pure, framework-agnostic helpers for relation (LTAR) cell editing — kept side-effect
// free so they can be unit tested in isolation (see test/ltar-deferred-ops.test.ts).
//
// The deferred-queue half (PendingLtarOp and friends) was brought in from the upstream
// OSS fix for the same feature: nocodb/nocodb#14058 — "fix(gui): defer relation field
// updates until save in expanded form" by Aakash Gautam (@aakashgautam-git).

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

/**
 * The shape a relation cell holds — decided by the CELL RENDERER (uidt), not by the link
 * version (#14013).
 */
export type LtarCellShape =
  | 'single' // BT/MO/OO (and BT-like V2 junctions): the linked record itself, or null
  | 'count' // `Links`: a numeric rollup
  | 'records' // LinkToAnotherRecord hm/mm: an array of chips — grid/list responses sometimes hand back a bare count

/** Cell value as a count, whichever shape it arrived in. */
export function ltarCellCount(value: unknown): number {
  return Array.isArray(value) ? value.length : Number(value) || 0
}

/**
 * Next cell value after ONE link/unlink, written so that re-applying it is a no-op.
 *
 * The nested add/remove request also fires an authoritative broadcast of the whole row
 * (`BaseModelSqlv2.broadcastLinkUpdates`), which `useInfiniteData` can apply to the same row
 * object *before* the request's own promise resolves — so a blind push / `count + 1` stacks a
 * delta on an already-correct value.
 *
 * Record arrays dedupe on the related row's pk. A count has no identity to dedupe on, so a
 * count that moved since `snapshot` (read before the await) is treated as the authoritative
 * write and left alone — at the cost of two back-to-back links landing one increment on a grid
 * that never receives the broadcast.
 */
export function applyLtarCellOp(params: {
  op: 'link' | 'unlink'
  shape: LtarCellShape
  /** Cell value now, i.e. after the await. */
  current: unknown
  /** Cell value read before the await. Pass `current` when there was no await. */
  snapshot: unknown
  relatedRow: Record<string, any>
  getRelatedRowId: (row: Record<string, any>) => unknown
}): unknown {
  const { op, shape, current, snapshot, relatedRow, getRelatedRowId } = params

  if (shape === 'single') return op === 'link' ? relatedRow : null

  if (shape === 'records' && Array.isArray(current)) {
    const relId = `${getRelatedRowId(relatedRow)}`

    if (op === 'unlink') {
      const next = current.filter((r) => `${getRelatedRowId(r)}` !== relId)
      return next.length === current.length ? current : next
    }

    return current.some((r) => `${getRelatedRowId(r)}` === relId) ? current : [...current, relatedRow]
  }

  if (ltarCellCount(current) !== ltarCellCount(snapshot)) return current

  return Math.max(0, ltarCellCount(snapshot) + (op === 'link' ? 1 : -1))
}

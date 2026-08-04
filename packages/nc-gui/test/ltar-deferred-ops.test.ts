/**
 * Unit tests for the pure deferred-LTAR queue logic used by the expanded form to keep
 * relation edits inside the Save/Discard workflow (#14013).
 *
 * Imports the actual pure functions from utils/ltarDeferredOps.ts — no mocks.
 *
 * Brought in from upstream nocodb/nocodb#14058 by Aakash Gautam (@aakashgautam-git).
 */

import { describe, expect, it } from 'vitest'
import { RelationTypes } from 'nocodb-sdk'
import {
  type PendingLtarOp,
  reconcilePendingLtarOp,
  resolveDeferredLtarCount,
  resolveDeferredSingleTargetValue,
} from '~/utils/ltarDeferredOps'

// ---- Helpers ----

function makeOp(
  op: 'link' | 'unlink',
  relatedRowId: string,
  { columnId = 'col_links', type = RelationTypes.HAS_MANY }: { columnId?: string; type?: RelationTypes } = {},
): PendingLtarOp {
  return {
    op,
    columnId,
    baseId: 'base1',
    tableId: 'tbl1',
    rowId: 'rec1',
    type,
    relatedRowId,
    record: { Id: relatedRowId, Title: `Row ${relatedRowId}` },
  }
}

function queueWith(...ops: PendingLtarOp[]): PendingLtarOp[] {
  const q: PendingLtarOp[] = []
  for (const op of ops) reconcilePendingLtarOp(q, op)
  return q
}

// ---- reconcilePendingLtarOp ----

describe('reconcilePendingLtarOp', () => {
  it('appends a new op and preserves insertion order', () => {
    const q = queueWith(makeOp('unlink', '1'), makeOp('link', '2'))
    expect(q.map((o) => [o.op, o.relatedRowId])).toEqual([
      ['unlink', '1'],
      ['link', '2'],
    ])
  })

  it('ignores a duplicate of the same op on the same record', () => {
    const q = queueWith(makeOp('unlink', '1'), makeOp('unlink', '1'))
    expect(q).toHaveLength(1)
  })

  it('cancels a queued op when its inverse on the same record is applied (link → unlink)', () => {
    const q = queueWith(makeOp('link', '5'), makeOp('unlink', '5'))
    expect(q).toHaveLength(0)
  })

  it('cancels a queued unlink when the record is re-linked (unlink → re-link = back to original)', () => {
    const q = queueWith(makeOp('unlink', '7'), makeOp('link', '7'))
    expect(q).toHaveLength(0)
  })

  it('keeps ops for different records independent', () => {
    const q = queueWith(makeOp('unlink', '1'), makeOp('unlink', '2'), makeOp('link', '1'))
    // unlink 1 cancelled by link 1; unlink 2 remains
    expect(q.map((o) => [o.op, o.relatedRowId])).toEqual([['unlink', '2']])
  })

  it('keeps same record on different columns independent', () => {
    const q = queueWith(makeOp('unlink', '1', { columnId: 'colA' }), makeOp('link', '1', { columnId: 'colB' }))
    expect(q).toHaveLength(2)
  })
})

// ---- resolveDeferredLtarCount (HM / MM) ----

describe('resolveDeferredLtarCount', () => {
  it('subtracts unlinks and adds links against the original count', () => {
    const q = queueWith(makeOp('unlink', '1'), makeOp('unlink', '2'), makeOp('link', '9'))
    expect(resolveDeferredLtarCount(q, 'col_links', 3)).toBe(2) // 3 - 2 + 1
  })

  it('never goes below zero', () => {
    const q = queueWith(makeOp('unlink', '1'), makeOp('unlink', '2'))
    expect(resolveDeferredLtarCount(q, 'col_links', 1)).toBe(0)
  })

  it('coerces a non-numeric original count to 0', () => {
    const q = queueWith(makeOp('link', '1'))
    expect(resolveDeferredLtarCount(q, 'col_links', undefined as unknown as number)).toBe(1)
  })

  it('ignores ops belonging to other columns', () => {
    const q = queueWith(makeOp('link', '1', { columnId: 'other' }))
    expect(resolveDeferredLtarCount(q, 'col_links', 4)).toBe(4)
  })
})

// ---- resolveDeferredSingleTargetValue (BT / OO / MO) ----

describe('resolveDeferredSingleTargetValue', () => {
  const original = { Id: '100', Title: 'Original' }

  it('returns the original server value when no ops are queued', () => {
    expect(resolveDeferredSingleTargetValue([], 'col_bt', original)).toBe(original)
  })

  it('returns null after an unlink', () => {
    const q = queueWith(makeOp('unlink', '100', { columnId: 'col_bt', type: RelationTypes.BELONGS_TO }))
    expect(resolveDeferredSingleTargetValue(q, 'col_bt', original)).toBeNull()
  })

  it('returns the latest linked record on replace', () => {
    const q = queueWith(
      makeOp('link', '200', { columnId: 'col_bt', type: RelationTypes.BELONGS_TO }),
      makeOp('link', '300', { columnId: 'col_bt', type: RelationTypes.BELONGS_TO }),
    )
    expect(resolveDeferredSingleTargetValue(q, 'col_bt', original)?.Id).toBe('300')
  })

  it('falls back to original when a link is then cancelled', () => {
    const q = queueWith(
      makeOp('link', '200', { columnId: 'col_bt', type: RelationTypes.BELONGS_TO }),
      makeOp('unlink', '200', { columnId: 'col_bt', type: RelationTypes.BELONGS_TO }),
    )
    expect(resolveDeferredSingleTargetValue(q, 'col_bt', original)).toBe(original)
  })
})

// ---- end-to-end queue scenarios (regression coverage) ----

describe('queue scenarios', () => {
  it('multiple edits before save collapse to the minimal API set', () => {
    // link A, unlink B, unlink A (cancels link A), link C
    const q = queueWith(makeOp('link', 'A'), makeOp('unlink', 'B'), makeOp('unlink', 'A'), makeOp('link', 'C'))
    expect(q.map((o) => [o.op, o.relatedRowId])).toEqual([
      ['unlink', 'B'],
      ['link', 'C'],
    ])
  })

  it('add-then-remove of the same record is a no-op (no API call, not dirty)', () => {
    const q = queueWith(makeOp('link', 'X'), makeOp('unlink', 'X'))
    expect(q).toHaveLength(0)
  })
})

/**
 * Unit tests for the pure LTAR cell logic — the deferred queue used by the expanded form to
 * keep relation edits inside the Save/Discard workflow (#14013), and the single-op cell write
 * used by inline grid link/unlink.
 *
 * Imports the actual pure functions from utils/ltarDeferredOps.ts — no mocks.
 *
 * The deferred-queue tests came from upstream nocodb/nocodb#14058 by Aakash Gautam
 * (@aakashgautam-git).
 */

import { describe, expect, it } from 'vitest'
import { RelationTypes } from 'nocodb-sdk'
import {
  type PendingLtarOp,
  applyLtarCellOp,
  ltarCellCount,
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

// ---- applyLtarCellOp (inline grid link/unlink) ----

describe('applyLtarCellOp', () => {
  const catA = { Id: 'A', Title: 'Cat-A' }
  const catB = { Id: 'B', Title: 'Cat-B' }
  const getRelatedRowId = (r: Record<string, any>) => r.Id

  const apply = (op: 'link' | 'unlink', shape: 'single' | 'count' | 'records', current: unknown, snapshot: unknown = current) =>
    applyLtarCellOp({ op, shape, current, snapshot, relatedRow: catA, getRelatedRowId })

  describe('single (BT / MO / OO)', () => {
    it('writes the picked record on link and null on unlink', () => {
      expect(apply('link', 'single', null)).toBe(catA)
      expect(apply('unlink', 'single', catA)).toBeNull()
    })

    it('is idempotent — re-applying over the authoritative value keeps it', () => {
      expect(apply('link', 'single', catA, null)).toBe(catA)
      expect(apply('unlink', 'single', null, catA)).toBeNull()
    })
  })

  describe('records (LinkToAnotherRecord hm / mm)', () => {
    it('appends the linked record', () => {
      expect(apply('link', 'records', [catB])).toEqual([catB, catA])
    })

    it('does not append a record the realtime broadcast already wrote (#9376 double chip)', () => {
      const authoritative = [{ Id: 'A', Title: 'Cat-A' }]
      expect(apply('link', 'records', authoritative, [])).toBe(authoritative)
    })

    it('removes the unlinked record', () => {
      expect(apply('unlink', 'records', [catA, catB])).toEqual([catB])
    })

    it('leaves the array untouched when the record is already gone', () => {
      const authoritative = [catB]
      expect(apply('unlink', 'records', authoritative, [catA, catB])).toBe(authoritative)
    })

    it('falls back to count arithmetic when the cell holds a count instead of records', () => {
      // grid/list responses can hand back a rollup for a to-many LTAR cell (Sentry JAVASCRIPT-14TJ)
      expect(apply('link', 'records', 2)).toBe(3)
      expect(apply('unlink', 'records', 2)).toBe(1)
    })
  })

  describe('count (Links)', () => {
    it('increments on link and decrements on unlink', () => {
      expect(apply('link', 'count', 2)).toBe(3)
      expect(apply('unlink', 'count', 2)).toBe(1)
    })

    it('never goes below zero', () => {
      expect(apply('unlink', 'count', 0)).toBe(0)
    })

    it('treats a missing/blank cell as 0', () => {
      expect(apply('link', 'count', undefined)).toBe(1)
      expect(apply('link', 'count', null)).toBe(1)
    })

    it('defers to a count that moved while the request was in flight', () => {
      // realtime already wrote the authoritative 2 — incrementing again would show 3
      expect(apply('link', 'count', 2, 1)).toBe(2)
      expect(apply('unlink', 'count', 2, 3)).toBe(2)
    })

    it('still applies its delta when nothing else touched the cell', () => {
      expect(apply('link', 'count', 1, 1)).toBe(2)
    })
  })
})

describe('ltarCellCount', () => {
  it('reads both cell shapes as a count', () => {
    expect(ltarCellCount([{ Id: 'A' }, { Id: 'B' }])).toBe(2)
    expect(ltarCellCount(3)).toBe(3)
    expect(ltarCellCount('3')).toBe(3)
  })

  it('coerces missing / non-numeric values to 0', () => {
    expect(ltarCellCount(undefined)).toBe(0)
    expect(ltarCellCount(null)).toBe(0)
    expect(ltarCellCount('abc')).toBe(0)
  })
})

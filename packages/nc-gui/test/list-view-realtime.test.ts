/**
 * Unit tests for list view realtime cache manipulation logic.
 *
 * Imports the actual pure functions from listViewCache.ts — no mocks.
 */

import {
  type ListViewRow,
  collectRowAndDescendants,
  doesUpdateAffectSort,
  findCachedRowByPk,
  findSortedInsertIndex,
  insertRowsAt,
  pruneEmptyParents,
  removeRowsAndShift,
} from '~/ee/components/smartsheet/list/composables/listViewCache'
import { sortByUIType } from '~/utils/sortUtils'

// ---- Helpers ----

function makeRow(
  depth: number,
  pk: string | number,
  parentId: string | null,
  tableId: string,
  extra: Record<string, any> = {},
): ListViewRow {
  return { __nc_depth: depth, __nc_pk: pk, __nc_parent_id: parentId, __nc_row_type: tableId, __nc_descendant_count: 0, ...extra }
}

function cacheToArray(cache: Map<number, ListViewRow>): (string | number)[] {
  return Array.from(cache.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row.__nc_pk)
}

function cacheEntries(cache: Map<number, ListViewRow>): [number, string | number][] {
  return Array.from(cache.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([idx, row]) => [idx, row.__nc_pk])
}

// Minimal columnsById for sort tests
function makeColumnsById(cols: { id: string; title: string; uidt: string }[]): Record<string, any> {
  const map: Record<string, any> = {}
  for (const c of cols) map[c.id] = c
  return map
}

// ========================================================================
// TESTS
// ========================================================================

describe('removeRowsAndShift', () => {
  it('removes single row and shifts subsequent', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1'))
    cache.set(1, makeRow(0, 'B', null, 't1'))
    cache.set(2, makeRow(0, 'C', null, 't1'))
    cache.set(3, makeRow(0, 'D', null, 't1'))
    const chunks: any[] = ['loaded', 'loaded']

    removeRowsAndShift(cache, chunks, [1])

    expect(cacheEntries(cache)).toEqual([
      [0, 'A'],
      [1, 'C'],
      [2, 'D'],
    ])
    expect(chunks[0]).toBeUndefined()
  })

  it('removes multiple non-contiguous rows', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1'))
    cache.set(1, makeRow(0, 'B', null, 't1'))
    cache.set(2, makeRow(0, 'C', null, 't1'))
    cache.set(3, makeRow(0, 'D', null, 't1'))
    cache.set(4, makeRow(0, 'E', null, 't1'))
    const chunks: any[] = ['loaded']

    removeRowsAndShift(cache, chunks, [1, 3])

    expect(cacheEntries(cache)).toEqual([
      [0, 'A'],
      [1, 'C'],
      [2, 'E'],
    ])
  })

  it('handles sparse cache (windowed)', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(50, makeRow(0, 'A', null, 't1'))
    cache.set(51, makeRow(0, 'B', null, 't1'))
    cache.set(52, makeRow(0, 'C', null, 't1'))
    cache.set(53, makeRow(0, 'D', null, 't1'))
    cache.set(54, makeRow(0, 'E', null, 't1'))
    const chunks: any[] = new Array(3).fill('loaded')

    removeRowsAndShift(cache, chunks, [52])

    expect(cacheEntries(cache)).toEqual([
      [50, 'A'],
      [51, 'B'],
      [52, 'D'],
      [53, 'E'],
    ])
  })

  it('removes contiguous subtree', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(0, 'P2', null, 't1'))
    cache.set(3, makeRow(1, 'C2', 'P2', 't2'))
    cache.set(4, makeRow(1, 'C3', 'P2', 't2'))
    cache.set(5, makeRow(0, 'P3', null, 't1'))
    const chunks: any[] = ['loaded']

    removeRowsAndShift(cache, chunks, [2, 3, 4])

    expect(cacheEntries(cache)).toEqual([
      [0, 'P1'],
      [1, 'C1'],
      [2, 'P3'],
    ])
  })
})

describe('insertRowsAt', () => {
  it('inserts at beginning', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'B', null, 't1'))
    cache.set(1, makeRow(0, 'C', null, 't1'))
    const chunks: any[] = ['loaded']

    insertRowsAt(cache, chunks, 0, [makeRow(0, 'A', null, 't1')])

    expect(cacheEntries(cache)).toEqual([
      [0, 'A'],
      [1, 'B'],
      [2, 'C'],
    ])
  })

  it('inserts in middle', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1'))
    cache.set(1, makeRow(0, 'C', null, 't1'))
    const chunks: any[] = ['loaded']

    insertRowsAt(cache, chunks, 1, [makeRow(0, 'B', null, 't1')])

    expect(cacheEntries(cache)).toEqual([
      [0, 'A'],
      [1, 'B'],
      [2, 'C'],
    ])
  })

  it('inserts at end', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1'))
    cache.set(1, makeRow(0, 'B', null, 't1'))
    const chunks: any[] = ['loaded']

    insertRowsAt(cache, chunks, 2, [makeRow(0, 'C', null, 't1')])

    expect(cacheEntries(cache)).toEqual([
      [0, 'A'],
      [1, 'B'],
      [2, 'C'],
    ])
  })

  it('inserts multiple rows (subtree)', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(0, 'P2', null, 't1'))
    const chunks: any[] = ['loaded']

    insertRowsAt(cache, chunks, 1, [makeRow(1, 'C1', 'P1', 't2'), makeRow(1, 'C2', 'P1', 't2')])

    expect(cacheEntries(cache)).toEqual([
      [0, 'P1'],
      [1, 'C1'],
      [2, 'C2'],
      [3, 'P2'],
    ])
  })

  it('handles sparse cache', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(50, makeRow(0, 'A', null, 't1'))
    cache.set(51, makeRow(0, 'B', null, 't1'))
    cache.set(52, makeRow(0, 'C', null, 't1'))
    const chunks: any[] = new Array(3).fill('loaded')

    insertRowsAt(cache, chunks, 51, [makeRow(0, 'X', null, 't1')])

    expect(cacheEntries(cache)).toEqual([
      [50, 'A'],
      [51, 'X'],
      [52, 'B'],
      [53, 'C'],
    ])
    expect(chunks[1]).toBeUndefined()
  })
})

describe('collectRowAndDescendants', () => {
  it('collects single leaf row', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(0, 'P2', null, 't1'))

    const { indices, removedCounts } = collectRowAndDescendants(cache, 3, 1, 1)
    expect(indices).toEqual([1])
    expect(removedCounts).toEqual({ t2: 1 })
  })

  it('collects parent with all descendants', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(2, 'G1', 'C1', 't3'))
    cache.set(3, makeRow(2, 'G2', 'C1', 't3'))
    cache.set(4, makeRow(1, 'C2', 'P1', 't2'))
    cache.set(5, makeRow(0, 'P2', null, 't1'))

    const { indices, removedCounts } = collectRowAndDescendants(cache, 6, 0, 0)
    expect(indices).toEqual([0, 1, 2, 3, 4])
    expect(removedCounts).toEqual({ t1: 1, t2: 2, t3: 2 })
  })

  it('stops at same-depth sibling', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(1, 'C2', 'P1', 't2'))

    const { indices } = collectRowAndDescendants(cache, 3, 1, 1)
    expect(indices).toEqual([1])
  })
})

describe('findSortedInsertIndex', () => {
  const cols = makeColumnsById([{ id: 'col_name', title: 'name', uidt: 'SingleLineText' }])
  const colsNum = makeColumnsById([{ id: 'col_score', title: 'score', uidt: 'Number' }])
  const colsBoth = makeColumnsById([
    { id: 'col_name', title: 'name', uidt: 'SingleLineText' },
    { id: 'col_age', title: 'age', uidt: 'Number' },
  ])

  it('no sorts — appends to end of siblings', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { name: 'Alpha' }))
    cache.set(1, makeRow(0, 'B', null, 't1', { name: 'Beta' }))

    expect(findSortedInsertIndex(cache, 2, { name: 'Gamma' }, 0, null, [], cols)).toBe(2)
  })

  it('ASC sort — inserts in correct position', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { name: 'Alpha' }))
    cache.set(1, makeRow(0, 'B', null, 't1', { name: 'Charlie' }))
    cache.set(2, makeRow(0, 'C', null, 't1', { name: 'Echo' }))

    expect(
      findSortedInsertIndex(
        cache,
        3,
        { name: 'Beta' },
        0,
        null,
        [{ title: 'name', fk_column_id: 'col_name', direction: 'asc' }],
        cols,
      ),
    ).toBe(1)
  })

  it('DESC sort — inserts in correct position', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { name: 'Echo' }))
    cache.set(1, makeRow(0, 'B', null, 't1', { name: 'Charlie' }))
    cache.set(2, makeRow(0, 'C', null, 't1', { name: 'Alpha' }))

    expect(
      findSortedInsertIndex(
        cache,
        3,
        { name: 'Delta' },
        0,
        null,
        [{ title: 'name', fk_column_id: 'col_name', direction: 'desc' }],
        cols,
      ),
    ).toBe(1)
  })

  it('multi-column sort', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { name: 'Alpha', age: 10 }))
    cache.set(1, makeRow(0, 'B', null, 't1', { name: 'Alpha', age: 30 }))
    cache.set(2, makeRow(0, 'C', null, 't1', { name: 'Beta', age: 20 }))

    const sorts = [
      { title: 'name', fk_column_id: 'col_name', direction: 'asc' as const },
      { title: 'age', fk_column_id: 'col_age', direction: 'asc' as const },
    ]

    expect(findSortedInsertIndex(cache, 3, { name: 'Alpha', age: 20 }, 0, null, sorts, colsBoth)).toBe(1)
  })

  it('sorted insert among children of a parent', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2', { name: 'Alpha' }))
    cache.set(2, makeRow(1, 'C2', 'P1', 't2', { name: 'Charlie' }))
    cache.set(3, makeRow(0, 'P2', null, 't1'))

    expect(
      findSortedInsertIndex(
        cache,
        4,
        { name: 'Beta' },
        1,
        0,
        [{ title: 'name', fk_column_id: 'col_name', direction: 'asc' }],
        cols,
      ),
    ).toBe(2)
  })

  it('insert first child of parent (no existing siblings)', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(0, 'P2', null, 't1'))

    expect(
      findSortedInsertIndex(
        cache,
        2,
        { name: 'Child' },
        1,
        0,
        [{ title: 'name', fk_column_id: 'col_name', direction: 'asc' }],
        cols,
      ),
    ).toBe(1)
  })

  it('numeric sort', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { score: 10 }))
    cache.set(1, makeRow(0, 'B', null, 't1', { score: 30 }))
    cache.set(2, makeRow(0, 'C', null, 't1', { score: 50 }))

    expect(
      findSortedInsertIndex(
        cache,
        3,
        { score: 25 },
        0,
        null,
        [{ title: 'score', fk_column_id: 'col_score', direction: 'asc' }],
        colsNum,
      ),
    ).toBe(1)
  })
})

describe('doesUpdateAffectSort', () => {
  it('returns true when a sort column is in the payload', () => {
    const cols = makeColumnsById([{ id: 'c1', title: 'name', uidt: 'SingleLineText' }])
    const sorts = [{ fk_column_id: 'c1', direction: 'asc' }] as any

    expect(doesUpdateAffectSort({ name: 'new' }, sorts, cols)).toBe(true)
  })

  it('returns false when payload has no sort columns', () => {
    const cols = makeColumnsById([
      { id: 'c1', title: 'name', uidt: 'SingleLineText' },
      { id: 'c2', title: 'email', uidt: 'Email' },
    ])
    const sorts = [{ fk_column_id: 'c1', direction: 'asc' }] as any

    expect(doesUpdateAffectSort({ email: 'a@b.com' }, sorts, cols)).toBe(false)
  })

  it('returns false when no sorts', () => {
    expect(doesUpdateAffectSort({ name: 'new' }, [], {})).toBe(false)
  })
})

describe('pruneEmptyParents', () => {
  it('prunes parent when last child removed', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(0, 'P2', null, 't1'))
    const chunks: any[] = ['loaded']
    const totalRows = { value: 2 }
    const levelCounts = { t1: 2 }

    pruneEmptyParents(cache, chunks, totalRows, levelCounts, 'P1', 0)

    expect(cacheToArray(cache)).toEqual(['P2'])
    expect(totalRows.value).toBe(1)
    expect(levelCounts.t1).toBe(1)
  })

  it('does not prune parent that still has children', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(1, 'C2', 'P1', 't2'))
    const chunks: any[] = ['loaded']
    const totalRows = { value: 3 }
    const levelCounts = { t1: 1, t2: 2 }

    pruneEmptyParents(cache, chunks, totalRows, levelCounts, 'P1', 0)

    expect(cache.size).toBe(3)
  })

  it('cascading prune: child → parent → grandparent', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'GP', null, 't1'))
    cache.set(1, makeRow(1, 'P', 'GP', 't2'))
    cache.set(2, makeRow(0, 'OTHER', null, 't1'))
    const chunks: any[] = ['loaded']
    const totalRows = { value: 3 }
    const levelCounts = { t1: 2, t2: 1 }

    pruneEmptyParents(cache, chunks, totalRows, levelCounts, 'P', 1)

    expect(cacheToArray(cache)).toEqual(['OTHER'])
    expect(totalRows.value).toBe(1)
    expect(levelCounts).toEqual({ t1: 1, t2: 0 })
  })
})

describe('sortByUIType (grid utility reuse)', () => {
  it('numbers ascending', () => {
    expect(sortByUIType({ uidt: 'Number' as any, a: 1, b: 2, options: { direction: 'asc' } })).toBeLessThan(0)
    expect(sortByUIType({ uidt: 'Number' as any, a: 2, b: 1, options: { direction: 'asc' } })).toBeGreaterThan(0)
  })

  it('numbers descending', () => {
    expect(sortByUIType({ uidt: 'Number' as any, a: 1, b: 2, options: { direction: 'desc' } })).toBeGreaterThan(0)
  })

  it('strings', () => {
    expect(sortByUIType({ uidt: 'SingleLineText' as any, a: 'a', b: 'b', options: { direction: 'asc' } })).toBeLessThan(0)
  })

  it('checkbox sort', () => {
    expect(sortByUIType({ uidt: 'Checkbox' as any, a: false, b: true, options: { direction: 'asc' } })).toBeGreaterThan(0)
  })
})

describe('integration: ADD cache window handling', () => {
  const cols = makeColumnsById([{ id: 'col_name', title: 'name', uidt: 'SingleLineText' }])

  it('within cached range — row inserted at sorted position', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { name: 'Alpha' }))
    cache.set(1, makeRow(0, 'C', null, 't1', { name: 'Charlie' }))

    const newRow = makeRow(0, 'B', null, 't1', { name: 'Beta' })
    const insertAt = findSortedInsertIndex(
      cache,
      2,
      newRow,
      0,
      null,
      [{ title: 'name', fk_column_id: 'col_name', direction: 'asc' }],
      cols,
    )

    insertRowsAt(cache, ['loaded'], insertAt, [newRow])

    expect(cacheToArray(cache)).toEqual(['A', 'B', 'C'])
  })

  it('insert at position 0 when cache starts at 0 — row IS inserted', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'B', null, 't1', { name: 'Beta' }))
    cache.set(1, makeRow(0, 'C', null, 't1', { name: 'Charlie' }))
    let totalRows = 2

    const newRow = makeRow(0, 'A', null, 't1', { name: 'Alpha' })
    const insertAt = findSortedInsertIndex(
      cache,
      totalRows,
      newRow,
      0,
      null,
      [{ title: 'name', fk_column_id: 'col_name', direction: 'asc' }],
      cols,
    )

    expect(insertAt).toBe(0)

    // cacheMin === 0, so this is NOT "before the window" — it's within range
    const cachedKeys = Array.from(cache.keys())
    const cacheMin = Math.min(...cachedKeys)

    // The condition: insertAt < cacheMin && cacheMin > 0 → false (cacheMin is 0)
    // So we fall through to insertRowsAt
    expect(cacheMin).toBe(0)
    insertRowsAt(cache, ['loaded'], insertAt, [newRow])
    totalRows++

    expect(cacheToArray(cache)).toEqual(['A', 'B', 'C'])
    expect(totalRows).toBe(3)
  })

  it('before cached range (windowed) — shift indices only', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(50, makeRow(0, 'X', null, 't1'))
    cache.set(51, makeRow(0, 'Y', null, 't1'))
    cache.set(52, makeRow(0, 'Z', null, 't1'))

    // Simulate: insertAt=5, which is before cacheMin=50
    const entries = Array.from(cache.entries()).sort((a, b) => b[0] - a[0])
    for (const [idx, row] of entries) {
      cache.delete(idx)
      cache.set(idx + 1, row)
    }

    expect(cacheEntries(cache)).toEqual([
      [51, 'X'],
      [52, 'Y'],
      [53, 'Z'],
    ])
  })
})

describe('integration: UPDATE sort reposition', () => {
  it('moves row to correct sorted position', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1', { score: 10 }))
    cache.set(1, makeRow(0, 'B', null, 't1', { score: 20 }))
    cache.set(2, makeRow(0, 'C', null, 't1', { score: 30 }))
    const chunks: any[] = ['loaded']
    const colsNum = makeColumnsById([{ id: 'col_score', title: 'score', uidt: 'Number' }])

    const cachedRow = cache.get(0)!
    Object.assign(cachedRow, { score: 25 })

    const { indices } = collectRowAndDescendants(cache, 3, 0, 0)
    const subtreeRows = indices.map((i) => cache.get(i)!).filter(Boolean)
    removeRowsAndShift(cache, chunks, indices)

    const newInsertAt = findSortedInsertIndex(
      cache,
      cache.size,
      cachedRow,
      0,
      null,
      [{ title: 'score', fk_column_id: 'col_score', direction: 'asc' }],
      colsNum,
    )
    insertRowsAt(cache, chunks, newInsertAt, subtreeRows)

    expect(cacheToArray(cache)).toEqual(['B', 'A', 'C'])
  })

  it('repositions non-root row among siblings under same parent', () => {
    // P1 has children C1(10), C2(20), C3(30). Update C1 score to 25 → should move between C2 and C3
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2', { score: 10 }))
    cache.set(2, makeRow(1, 'C2', 'P1', 't2', { score: 20 }))
    cache.set(3, makeRow(1, 'C3', 'P1', 't2', { score: 30 }))
    cache.set(4, makeRow(0, 'P2', null, 't1'))
    const chunks: any[] = ['loaded']
    const colsNum = makeColumnsById([{ id: 'col_score', title: 'score', uidt: 'Number' }])
    const totalRows = 5

    // Update C1's score
    const cachedRow = cache.get(1)!
    Object.assign(cachedRow, { score: 25 })

    // Remove C1 (index 1, depth 1 — leaf, no subtree)
    const { indices } = collectRowAndDescendants(cache, totalRows, 1, 1)
    expect(indices).toEqual([1])
    const subtreeRows = indices.map((i) => cache.get(i)!).filter(Boolean)
    removeRowsAndShift(cache, chunks, indices)

    // After removal: P1(0), C2(1), C3(2), P2(3)
    expect(cacheToArray(cache)).toEqual(['P1', 'C2', 'C3', 'P2'])

    // Find parent P1's index after shift
    const parent = findCachedRowByPk(cache, 'P1', 0)
    expect(parent).not.toBeNull()
    expect(parent!.index).toBe(0)

    // Find sorted position among P1's children (C2=20, C3=30) — C1(25) goes between them
    const newInsertAt = findSortedInsertIndex(
      cache,
      totalRows,
      cachedRow,
      1,
      parent!.index,
      [{ title: 'score', fk_column_id: 'col_score', direction: 'asc' }],
      colsNum,
    )
    expect(newInsertAt).toBe(2) // between C2(index 1) and C3(index 2)

    insertRowsAt(cache, chunks, newInsertAt, subtreeRows)

    expect(cacheToArray(cache)).toEqual(['P1', 'C2', 'C1', 'C3', 'P2'])
  })

  it('repositions row to first position among siblings', () => {
    // Children under P1: C1(30), C2(20), C3(10) sorted desc. Update C1 score to 5 → moves to end
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2', { score: 30 }))
    cache.set(2, makeRow(1, 'C2', 'P1', 't2', { score: 20 }))
    cache.set(3, makeRow(1, 'C3', 'P1', 't2', { score: 10 }))
    const chunks: any[] = ['loaded']
    const colsNum = makeColumnsById([{ id: 'col_score', title: 'score', uidt: 'Number' }])

    // Update C3 score to 35 → should move to first position (desc sort)
    const cachedRow = cache.get(3)!
    Object.assign(cachedRow, { score: 35 })

    const { indices } = collectRowAndDescendants(cache, 4, 3, 1)
    const subtreeRows = indices.map((i) => cache.get(i)!).filter(Boolean)
    removeRowsAndShift(cache, chunks, indices)

    // After removal: P1(0), C1(1), C2(2)
    const parent = findCachedRowByPk(cache, 'P1', 0)

    const newInsertAt = findSortedInsertIndex(
      cache,
      4,
      cachedRow,
      1,
      parent!.index,
      [{ title: 'score', fk_column_id: 'col_score', direction: 'desc' }],
      colsNum,
    )
    expect(newInsertAt).toBe(1) // before C1(30)

    insertRowsAt(cache, chunks, newInsertAt, subtreeRows)

    expect(cacheToArray(cache)).toEqual(['P1', 'C3', 'C1', 'C2'])
  })
})

describe('integration: DELETE subtree + prune', () => {
  it('delete last child prunes parent', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(0, 'P2', null, 't1'))
    cache.set(3, makeRow(1, 'C2', 'P2', 't2'))
    const chunks: any[] = ['loaded']
    const totalRows = { value: 4 }
    const levelCounts: Record<string, number> = { t1: 2, t2: 2 }

    const { indices, removedCounts } = collectRowAndDescendants(cache, totalRows.value, 1, 1)
    removeRowsAndShift(cache, chunks, indices)
    totalRows.value -= indices.length
    for (const [m, c] of Object.entries(removedCounts)) levelCounts[m] -= c

    pruneEmptyParents(cache, chunks, totalRows, levelCounts, 'P1', 0)

    expect(cacheToArray(cache)).toEqual(['P2', 'C2'])
    expect(totalRows.value).toBe(2)
    expect(levelCounts).toEqual({ t1: 1, t2: 1 })
  })

  it('delete parent removes entire subtree', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(2, 'G1', 'C1', 't3'))
    cache.set(3, makeRow(1, 'C2', 'P1', 't2'))
    cache.set(4, makeRow(0, 'P2', null, 't1'))
    const chunks: any[] = ['loaded']
    const totalRows = { value: 5 }
    const levelCounts: Record<string, number> = { t1: 2, t2: 2, t3: 1 }

    const { indices, removedCounts } = collectRowAndDescendants(cache, totalRows.value, 0, 0)
    removeRowsAndShift(cache, chunks, indices)
    totalRows.value -= indices.length
    for (const [m, c] of Object.entries(removedCounts)) levelCounts[m] -= c

    expect(cacheToArray(cache)).toEqual(['P2'])
    expect(totalRows.value).toBe(1)
    expect(levelCounts).toEqual({ t1: 1, t2: 0, t3: 0 })
  })
})

describe('integration: REORDER', () => {
  it('reorder row before a specific row', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'A', null, 't1'))
    cache.set(1, makeRow(0, 'B', null, 't1'))
    cache.set(2, makeRow(0, 'C', null, 't1'))
    cache.set(3, makeRow(0, 'D', null, 't1'))
    const chunks: any[] = ['loaded']

    const { indices } = collectRowAndDescendants(cache, 4, 2, 0)
    const subtreeRows = indices.map((i) => cache.get(i)!).filter(Boolean)
    removeRowsAndShift(cache, chunks, indices)

    const beforeRow = findCachedRowByPk(cache, 'A', 0)
    insertRowsAt(cache, chunks, beforeRow!.index, subtreeRows)

    expect(cacheToArray(cache)).toEqual(['C', 'A', 'B', 'D'])
  })

  it('reorder parent with subtree', () => {
    const cache = new Map<number, ListViewRow>()
    cache.set(0, makeRow(0, 'P1', null, 't1'))
    cache.set(1, makeRow(1, 'C1', 'P1', 't2'))
    cache.set(2, makeRow(0, 'P2', null, 't1'))
    cache.set(3, makeRow(1, 'C2', 'P2', 't2'))
    cache.set(4, makeRow(0, 'P3', null, 't1'))
    const chunks: any[] = ['loaded']

    const { indices } = collectRowAndDescendants(cache, 5, 2, 0)
    expect(indices).toEqual([2, 3])

    const subtreeRows = indices.map((i) => cache.get(i)!).filter(Boolean)
    removeRowsAndShift(cache, chunks, indices)

    const beforeRow = findCachedRowByPk(cache, 'P1', 0)
    insertRowsAt(cache, chunks, beforeRow!.index, subtreeRows)

    expect(cacheToArray(cache)).toEqual(['P2', 'C2', 'P1', 'C1', 'P3'])
  })
})

describe('chunk state invalidation', () => {
  it('removeRowsAndShift invalidates from first removed chunk onward', () => {
    const cache = new Map<number, ListViewRow>()
    for (let i = 0; i < 120; i++) cache.set(i, makeRow(0, `R${i}`, null, 't1'))
    const chunks: any[] = ['loaded', 'loaded', 'loaded']

    removeRowsAndShift(cache, chunks, [60])

    expect(chunks[0]).toBe('loaded')
    expect(chunks[1]).toBeUndefined()
    expect(chunks[2]).toBeUndefined()
  })

  it('insertRowsAt invalidates from insert chunk onward', () => {
    const cache = new Map<number, ListViewRow>()
    for (let i = 0; i < 120; i++) cache.set(i, makeRow(0, `R${i}`, null, 't1'))
    const chunks: any[] = ['loaded', 'loaded', 'loaded']

    insertRowsAt(cache, chunks, 55, [makeRow(0, 'NEW', null, 't1')])

    expect(chunks[0]).toBe('loaded')
    expect(chunks[1]).toBeUndefined()
    expect(chunks[2]).toBeUndefined()
  })
})

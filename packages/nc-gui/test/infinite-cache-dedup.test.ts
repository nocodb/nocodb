/**
 * Unit tests for `upsertCachedRows` — the infinite-scroll cache writer that guards
 * against the "same record appears twice on grid" bug (#9464).
 *
 * Repro of the underlying race: a record leaves the view (status edit), `clearInvalidRows`
 * optimistically shifts the rows below it up by one, then a chunk fetch that was issued
 * against the pre-shift state resolves and re-adds the same record at its old index. The
 * record is then cached at two indices and renders twice at the buffer boundary.
 *
 * `upsertCachedRows` writes the freshly-fetched rows but first drops any other cache entry
 * carrying the same primary key, so the cache can never hold the same record twice.
 */

import { describe, expect, it } from 'vitest'
import { upsertCachedRows } from '~/utils/infiniteCacheUtils'

// Mirrors how the grid composables call it: extract the pk from the row's `Id` column.
const getPk = (row: Record<string, any>): string | null => (row.Id === undefined || row.Id === null ? null : `${row.Id}`)

const makeRow = (id: number, rowIndex: number): Row =>
  ({
    row: { Id: id, Title: `Row ${id}` },
    oldRow: {},
    rowMeta: { rowIndex },
  } as unknown as Row)

const pkCount = (cache: Map<number, Row>) => {
  const counts = new Map<string, number>()
  for (const row of cache.values()) {
    const pk = getPk(row.row)!
    counts.set(pk, (counts.get(pk) ?? 0) + 1)
  }
  return counts
}

describe('upsertCachedRows', () => {
  it('removes a stale duplicate of the same record sitting at a different index', () => {
    // After an optimistic shift, record 100 has moved up to index 99.
    const cache = new Map<number, Row>()
    for (let i = 50; i <= 99; i++) cache.set(i, makeRow(i + 1, i)) // index 99 -> record 100

    // A stale chunk fetch (offset 100) resolves and would re-add record 100 at index 100.
    const fetched = [makeRow(100, 100), makeRow(101, 101)]

    upsertCachedRows(cache, fetched, getPk)

    // Record 100 must exist exactly once across the whole cache.
    expect(pkCount(cache).get('100')).toBe(1)
    for (const [, count] of pkCount(cache)) expect(count).toBe(1)
  })

  it('overwrites the same index without dropping the row it just wrote', () => {
    const cache = new Map<number, Row>()
    cache.set(10, makeRow(11, 10))

    upsertCachedRows(cache, [makeRow(11, 10)], getPk)

    expect(cache.size).toBe(1)
    expect(getPk(cache.get(10)!.row)).toBe('11')
  })

  it('leaves unrelated rows untouched and writes the new ones', () => {
    const cache = new Map<number, Row>()
    cache.set(0, makeRow(1, 0))
    cache.set(1, makeRow(2, 1))

    upsertCachedRows(cache, [makeRow(3, 2), makeRow(4, 3)], getPk)

    expect(cache.size).toBe(4)
    expect([...cache.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3])
    for (const [, count] of pkCount(cache)) expect(count).toBe(1)
  })

  it('does not dedup unsaved rows that have no primary key', () => {
    const cache = new Map<number, Row>()
    const newA = { row: { Title: 'A' }, oldRow: {}, rowMeta: { rowIndex: 5, new: true } } as unknown as Row
    cache.set(5, newA)

    const newB = { row: { Title: 'B' }, oldRow: {}, rowMeta: { rowIndex: 6, new: true } } as unknown as Row
    upsertCachedRows(cache, [newB], getPk)

    // Both pk-less rows survive — they aren't duplicates of each other.
    expect(cache.size).toBe(2)
  })

  it('is a no-op for an empty fetch result', () => {
    const cache = new Map<number, Row>()
    cache.set(0, makeRow(1, 0))

    upsertCachedRows(cache, [], getPk)

    expect(cache.size).toBe(1)
  })
})

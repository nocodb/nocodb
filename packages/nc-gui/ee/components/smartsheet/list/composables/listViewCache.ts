/**
 * Pure cache manipulation functions for the list view.
 *
 * These operate on plain Map<number, ListViewRow> and arrays — no Vue reactivity.
 * Extracted so they can be unit-tested independently and shared by useCanvasListView.
 */

import type { ColumnType, SortType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { CHUNK_SIZE } from './constants'
import { getColumnUidtByID, isSortRelevantChange, sortByUIType } from '~/utils/sortUtils'

export interface ListViewRow {
  __nc_depth: number
  __nc_pk: string | number
  __nc_parent_id: string | null
  __nc_row_type: string
  __nc_descendant_count: number
  __nc_color?: any
  [key: string]: any
}

/**
 * Find a row in the cache by its PK and depth.
 */
export function findCachedRowByPk(
  cachedRows: Map<number, ListViewRow>,
  pk: string,
  depth: number,
): { index: number; row: ListViewRow } | null {
  for (const [index, row] of cachedRows.entries()) {
    if (String(row.__nc_pk) === String(pk) && row.__nc_depth === depth) {
      return { index, row }
    }
  }
  return null
}

/**
 * Find the insertion index for a new child row.
 * Walks forward from the parent's index until depth decreases back to parent level or below.
 */
export function findInsertIndexForChild(
  cachedRows: Map<number, ListViewRow>,
  totalRows: number,
  parentIndex: number,
  parentDepth: number,
): number {
  let insertAt = parentIndex + 1
  while (insertAt < totalRows) {
    const row = cachedRows.get(insertAt)
    if (!row || row.__nc_depth <= parentDepth) break
    insertAt++
  }
  return insertAt
}

/**
 * Remove a row and all its descendants from the flat cache.
 * Returns the set of removed row indices (sorted ascending) and per-model removal counts.
 */
export function collectRowAndDescendants(
  cachedRows: Map<number, ListViewRow>,
  totalRows: number,
  startIndex: number,
  startDepth: number,
): { indices: number[]; removedCounts: Record<string, number> } {
  const indices: number[] = [startIndex]
  const removedCounts: Record<string, number> = {}

  const startRow = cachedRows.get(startIndex)
  if (startRow) {
    removedCounts[startRow.__nc_row_type] = (removedCounts[startRow.__nc_row_type] || 0) + 1
  }

  let i = startIndex + 1
  while (i < totalRows) {
    const row = cachedRows.get(i)
    if (!row || row.__nc_depth <= startDepth) break
    indices.push(i)
    removedCounts[row.__nc_row_type] = (removedCounts[row.__nc_row_type] || 0) + 1
    i++
  }

  return { indices, removedCounts }
}

/**
 * Remove rows at the given indices from the cache, shift subsequent rows up,
 * and invalidate affected chunk states.
 */
export function removeRowsAndShift(
  cachedRows: Map<number, ListViewRow>,
  chunkStates: Array<'loading' | 'loaded' | undefined>,
  indicesToRemove: number[],
) {
  if (!indicesToRemove.length) return

  const sorted = [...indicesToRemove].sort((a, b) => a - b)

  for (const idx of sorted) {
    cachedRows.delete(idx)
  }

  const firstRemoved = sorted[0]

  const entriesToShift: [number, ListViewRow][] = []
  for (const [idx, row] of cachedRows.entries()) {
    if (idx >= firstRemoved) {
      entriesToShift.push([idx, row])
    }
  }
  entriesToShift.sort((a, b) => a[0] - b[0])

  for (const [idx] of entriesToShift) {
    cachedRows.delete(idx)
  }

  let removedBefore = 0
  let sortedPtr = 0
  for (const [idx, row] of entriesToShift) {
    while (sortedPtr < sorted.length && sorted[sortedPtr] <= idx) {
      removedBefore++
      sortedPtr++
    }
    cachedRows.set(idx - removedBefore, row)
  }

  const startChunk = Math.floor(firstRemoved / CHUNK_SIZE)
  for (let c = startChunk; c < chunkStates.length; c++) {
    chunkStates[c] = undefined
  }
}

/**
 * Insert rows at a specific index, shifting existing rows down.
 */
export function insertRowsAt(
  cachedRows: Map<number, ListViewRow>,
  chunkStates: Array<'loading' | 'loaded' | undefined>,
  insertAt: number,
  newRows: ListViewRow[],
) {
  if (!newRows.length) return

  const count = newRows.length
  const maxIndex = Math.max(-1, ...Array.from(cachedRows.keys()))

  for (let i = maxIndex; i >= insertAt; i--) {
    const row = cachedRows.get(i)
    if (row) {
      cachedRows.delete(i)
      cachedRows.set(i + count, row)
    }
  }

  for (let i = 0; i < newRows.length; i++) {
    cachedRows.set(insertAt + i, newRows[i])
  }

  const startChunk = Math.floor(insertAt / CHUNK_SIZE)
  for (let c = startChunk; c < chunkStates.length; c++) {
    chunkStates[c] = undefined
  }
}

/**
 * Find the correct sorted insertion index for a new row among its siblings.
 *
 * Uses `sortByUIType` from grid's sortUtils for proper UI-type-aware comparison
 * (handles DateTime, Checkbox, User, Attachment, etc.).
 */
export function findSortedInsertIndex(
  cachedRows: Map<number, ListViewRow>,
  totalRows: number,
  newRow: Record<string, any>,
  depth: number,
  parentIndex: number | null,
  sortFields: { title: string; fk_column_id: string; direction: 'asc' | 'desc' }[],
  columnsById: Record<string, ColumnType>,
): number {
  const siblingIndices: number[] = []

  if (depth === 0) {
    for (const [idx, row] of cachedRows.entries()) {
      if (row.__nc_depth === 0) siblingIndices.push(idx)
    }
    siblingIndices.sort((a, b) => a - b)
  } else if (parentIndex !== null) {
    let i = parentIndex + 1
    while (i < totalRows) {
      const row = cachedRows.get(i)
      if (!row || row.__nc_depth < depth) break
      if (row.__nc_depth === depth) siblingIndices.push(i)
      i++
    }
  }

  // No sorts — insert at end of siblings
  if (!sortFields.length) {
    if (siblingIndices.length === 0) {
      return parentIndex !== null ? parentIndex + 1 : totalRows
    }
    const lastSibling = siblingIndices[siblingIndices.length - 1]
    return findInsertIndexForChild(cachedRows, totalRows, lastSibling, depth)
  }

  // No siblings yet
  if (siblingIndices.length === 0) {
    return parentIndex !== null ? parentIndex + 1 : totalRows
  }

  // Binary search among siblings using sortByUIType
  let lo = 0
  let hi = siblingIndices.length

  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    const sibling = cachedRows.get(siblingIndices[mid])
    if (!sibling) {
      lo = mid + 1
      continue
    }

    let cmp = 0
    for (const { title, fk_column_id, direction } of sortFields) {
      const uidt = (getColumnUidtByID(fk_column_id, columnsById) || UITypes.SingleLineText) as UITypes
      cmp = sortByUIType({
        uidt,
        a: newRow[title],
        b: sibling[title],
        options: { direction },
      })
      if (cmp !== 0) break
    }

    if (cmp < 0) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  if (lo >= siblingIndices.length) {
    const lastSibling = siblingIndices[siblingIndices.length - 1]
    return findInsertIndexForChild(cachedRows, totalRows, lastSibling, depth)
  }

  return siblingIndices[lo]
}

/**
 * Check if an update touches any field that has an active sort.
 * Re-exports grid's isSortRelevantChange with a payload-friendly interface.
 */
export function doesUpdateAffectSort(
  payload: Record<string, any>,
  sorts: SortType[],
  columnsById: Record<string, ColumnType>,
): boolean {
  if (!sorts.length) return false
  const changedFields = Object.keys(payload)
  return isSortRelevantChange(changedFields, sorts, columnsById)
}

/**
 * After removing rows from the cache, check if any parent at the given depth
 * now has zero children. If so, prune it (and cascade upward).
 */
export function pruneEmptyParents(
  cachedRows: Map<number, ListViewRow>,
  chunkStates: Array<'loading' | 'loaded' | undefined>,
  totalRows: { value: number },
  levelCounts: Record<string, number>,
  parentPk: string,
  parentDepth: number,
) {
  if (parentDepth < 0) return

  const parent = findCachedRowByPk(cachedRows, parentPk, parentDepth)
  if (!parent) return

  const nextIdx = parent.index + 1
  const nextRow = cachedRows.get(nextIdx)
  const hasChildren = nextRow && nextRow.__nc_depth > parentDepth

  if (!hasChildren) {
    const parentTableId = parent.row.__nc_row_type
    const grandparentPk = parent.row.__nc_parent_id

    removeRowsAndShift(cachedRows, chunkStates, [parent.index])
    totalRows.value = Math.max(0, totalRows.value - 1)

    if (levelCounts[parentTableId] !== undefined) {
      levelCounts[parentTableId] = Math.max(0, levelCounts[parentTableId] - 1)
    }

    if (grandparentPk && parentDepth > 0) {
      pruneEmptyParents(cachedRows, chunkStates, totalRows, levelCounts, grandparentPk, parentDepth - 1)
    }
  }
}

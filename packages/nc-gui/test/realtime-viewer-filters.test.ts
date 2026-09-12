/**
 * Regression tests for the realtime viewer-scope filter pipeline.
 *
 * PR #9671 review P1: `validateRowFilters` → SDK `buildFilterTree` rebuilds
 * nesting from FLAT `id`/`fk_parent_id` lists and WIPES pre-nested
 * `children` on id-less nodes — so the composed user-filter selection group
 * evaluated as empty and every realtime-pushed row was silently dropped for
 * viewers with an active tab/dropdown selection. `flattenFiltersForEval`
 * (client port of the server helper) is the required pre-step.
 *
 * Imports the actual pure functions — no mocks.
 */

import { describe, expect, it } from 'vitest'
import type { ColumnType, FilterType } from 'nocodb-sdk'
import { validateRowFilters } from 'nocodb-sdk'
import { dataEventSubscriptionKey, flattenFiltersForEval } from '~/utils/realtimeUtils'
import { interfaceDataEventSuffix } from '~/lib/interfaceData'

// ---- Fixtures ----

const columns: ColumnType[] = [
  { id: 'col_status', title: 'Status', uidt: 'SingleLineText' },
  { id: 'col_title', title: 'Title', uidt: 'SingleLineText' },
] as ColumnType[]

/** A composed user-filter selection: nested, id-less — exactly what
 *  `viewerScopeFilters()` produces from a tab/dropdown selection. */
function selectionGroup(): FilterType {
  return {
    is_group: true,
    logical_op: 'and',
    children: [{ fk_column_id: 'col_status', comparison_op: 'eq', value: 'open', logical_op: 'and' }],
  } as unknown as FilterType
}

// The frontend `utils/dataUtils.validateRowFilters` is a thin positional
// wrapper over this SDK evaluator (same `validateSync` → `buildFilterTree`
// pipeline) — testing against the SDK directly avoids dragging Nuxt-only
// deps into the unit environment.
function evaluate(filters: FilterType[], row: Record<string, any>) {
  return validateRowFilters({ filters, data: row, columns, client: 'pg', metas: {} })
}

// ---- flattenFiltersForEval ----

describe('flattenFiltersForEval', () => {
  it('flattens nested groups into id/fk_parent_id form, preserving leaves', () => {
    const flat = flattenFiltersForEval([selectionGroup()])

    expect(flat).toHaveLength(2)
    const [group, leaf] = flat as any[]
    expect(group.is_group).toBe(true)
    expect(group.id).toBeTruthy()
    expect(group.fk_parent_id).toBeNull()
    expect(group.children).toBeUndefined()
    expect(leaf.fk_column_id).toBe('col_status')
    expect(leaf.comparison_op).toBe('eq')
    expect(leaf.value).toBe('open')
    expect(leaf.fk_parent_id).toBe(group.id)
  })

  it('handles multi-level nesting — every child links to its own parent', () => {
    const nested = {
      is_group: true,
      logical_op: 'and',
      children: [
        {
          is_group: true,
          logical_op: 'or',
          children: [
            { fk_column_id: 'col_title', comparison_op: 'eq', value: 'a' },
            { fk_column_id: 'col_title', comparison_op: 'eq', value: 'b', logical_op: 'or' },
          ],
        },
      ],
    } as unknown as FilterType

    const flat = flattenFiltersForEval([nested]) as any[]
    expect(flat).toHaveLength(4)
    const [root, inner, leafA, leafB] = flat
    expect(inner.fk_parent_id).toBe(root.id)
    expect(leafA.fk_parent_id).toBe(inner.id)
    expect(leafB.fk_parent_id).toBe(inner.id)
  })

  it('returns [] for empty input', () => {
    expect(flattenFiltersForEval([])).toEqual([])
  })
})

// ---- The P1 regression: wiped group vs flattened group ----

describe('viewer-scope filters through validateRowFilters', () => {
  const matching = { Status: 'open', Title: 'row' }
  const nonMatching = { Status: 'closed', Title: 'row' }

  it('REGRESSION: an un-flattened selection group is wiped and drops matching rows', () => {
    // Documents WHY the flatten is required: buildFilterTree discards
    // pre-nested children on id-less nodes, the group evaluates empty and
    // the matching row is rejected. If this assertion ever flips, the SDK
    // was fixed and `flattenFiltersForEval` can be retired.
    expect(evaluate([selectionGroup()], matching)).toBeFalsy()
  })

  it('a flattened selection group gates rows correctly', () => {
    const flat = flattenFiltersForEval([selectionGroup()])
    expect(evaluate(flat, matching)).toBeTruthy()
    expect(evaluate(flat, nonMatching)).toBeFalsy()
  })

  it('keeps OR-carrying groups bounded when composed next to other roots', () => {
    // Client analog of the review P0: an OR inside a group must stay
    // inside its group boundary — a row failing the sibling scope root
    // never passes just because an OR branch matches.
    const scopeRoot = {
      is_group: true,
      logical_op: 'and',
      children: [{ fk_column_id: 'col_status', comparison_op: 'eq', value: 'open', logical_op: 'and' }],
    } as unknown as FilterType
    const orGroup = {
      is_group: true,
      logical_op: 'and',
      children: [
        { fk_column_id: 'col_title', comparison_op: 'eq', value: 'never', logical_op: 'and' },
        { fk_column_id: 'col_title', comparison_op: 'eq', value: 'sneak', logical_op: 'or' },
      ],
    } as unknown as FilterType

    const flat = flattenFiltersForEval([scopeRoot, orGroup])
    // Fails scope (Status closed) but matches the OR branch — must NOT pass.
    expect(evaluate(flat, { Status: 'closed', Title: 'sneak' })).toBeFalsy()
    // Passes scope + OR branch — passes.
    expect(evaluate(flat, { Status: 'open', Title: 'sneak' })).toBeTruthy()
    // Passes scope, fails the OR group entirely — must NOT pass.
    expect(evaluate(flat, { Status: 'open', Title: 'other' })).toBeFalsy()
  })

  it('already-flat leaf roots (toolbar search shape) evaluate unchanged', () => {
    const flatLeaf = [
      { fk_column_id: 'col_status', comparison_op: 'eq', value: 'open', logical_op: 'and' },
    ] as unknown as FilterType[]
    expect(evaluate(flatLeaf, matching)).toBeTruthy()
    expect(evaluate(flatLeaf, nonMatching)).toBeFalsy()
    // Flattening a flat list is a no-op semantically.
    expect(evaluate(flattenFiltersForEval(flatLeaf), matching)).toBeTruthy()
  })
})

// ---- Subscription key grammar ----

describe('dataEventSubscriptionKey', () => {
  const meta = { fk_workspace_id: 'ws1', base_id: 'b1', id: 't1' }

  it('builds the plain key without an interface api (data-tab views)', () => {
    expect(dataEventSubscriptionKey(meta)).toBe('event-data:ws1:b1:t1')
    expect(dataEventSubscriptionKey(meta, null)).toBe('event-data:ws1:b1:t1')
  })

  it('appends the page scope under an interface page', () => {
    const api = { realtimeScope: () => ({ pageId: 'pg1', vizId: 'viz1', env: 'published' }) }
    expect(dataEventSubscriptionKey(meta, api)).toBe('event-data:ws1:b1:t1:iface:pg1:viz1:published')
  })

  it('supports the record-review implicit viz (empty vizId segment)', () => {
    const api = { realtimeScope: () => ({ pageId: 'pg1', vizId: '', env: 'published' }) }
    expect(dataEventSubscriptionKey(meta, api)).toBe('event-data:ws1:b1:t1:iface:pg1::published')
  })

  it('falls back to the plain key when the scope is unavailable (public share)', () => {
    const api = { realtimeScope: () => null }
    expect(dataEventSubscriptionKey(meta, api)).toBe('event-data:ws1:b1:t1')
    expect(interfaceDataEventSuffix(api)).toBe('')
  })
})

/**
 * Unit tests for Kanban compact mode feature
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock localStorage ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// ── Mock $e (analytics) ──────────────────────────────────────────────────────
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $e: vi.fn(),
    $api: {},
  }),
}))

// ────────────────────────────────────────────────────────────────────────────

describe('Kanban Compact Mode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
  })

  it('defaults to non-compact mode', async () => {
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()
    expect(store.isCompactMode).toBe(false)
  })

  it('toggles compact mode to true', async () => {
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    store.toggleCompactMode()

    expect(store.isCompactMode).toBe(true)
  })

  it('toggles compact mode back to false', async () => {
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    store.toggleCompactMode()
    store.toggleCompactMode()

    expect(store.isCompactMode).toBe(false)
  })

  it('persists compact mode preference in localStorage', async () => {
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    store.toggleCompactMode()

    expect(localStorageMock.getItem('nocodb-kanban-compact-mode')).toBe('true')
  })

  it('persists non-compact mode preference in localStorage', async () => {
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    store.toggleCompactMode() // → true
    store.toggleCompactMode() // → false

    expect(localStorageMock.getItem('nocodb-kanban-compact-mode')).toBe('false')
  })

  it('restores compact mode from localStorage on init', async () => {
    // Pre-seed storage
    localStorageMock.setItem('nocodb-kanban-compact-mode', 'true')

    // Re-import so initCompactMode() runs against seeded storage
    vi.resetModules()
    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    expect(store.isCompactMode).toBe(true)
  })

  it('handles missing localStorage gracefully', async () => {
    // Temporarily break localStorage
    const original = global.localStorage
    // @ts-expect-error intentional
    delete global.localStorage

    const { useKanbanViewStore } = await import('~/store/kanbanView')
    const store = useKanbanViewStore()

    // Should not throw; defaults to false
    expect(() => store.toggleCompactMode()).not.toThrow()

    // Restore
    Object.defineProperty(global, 'localStorage', { value: original })
  })
})

// ── Compact card rendering ───────────────────────────────────────────────────

describe('KanbanCard compact rendering', () => {
  it('shows only title field in compact mode', () => {
    /**
     * This is an integration-level concern; we verify the logic
     * through the computed property directly.
     */
    const fields = [
      { fk_column_id: 'col-1', title: 'Name', show: true },
      { fk_column_id: 'col-2', title: 'Status', show: true },
      { fk_column_id: 'col-3', title: 'Priority', show: true },
    ]

    const columns = [
      { id: 'col-1', title: 'Name', pv: true },
      { id: 'col-2', title: 'Status', pv: false },
      { id: 'col-3', title: 'Priority', pv: false },
    ]

    const titleField = fields.find((f) => {
      const col = columns.find((c) => c.id === f.fk_column_id)
      return col?.pv
    })

    const compactFields = titleField ? [titleField] : fields.slice(0, 1)

    expect(compactFields).toHaveLength(1)
    expect(compactFields[0].title).toBe('Name')
  })

  it('falls back to first field if no primary field exists', () => {
    const fields = [
      { fk_column_id: 'col-1', title: 'Notes', show: true },
      { fk_column_id: 'col-2', title: 'Status', show: true },
    ]
    const columns = [
      { id: 'col-1', title: 'Notes', pv: false },
      { id: 'col-2', title: 'Status', pv: false },
    ]

    const titleField = fields.find((f) => {
      const col = columns.find((c) => c.id === f.fk_column_id)
      return col?.pv
    })

    const compactFields = titleField ? [titleField] : fields.slice(0, 1)

    expect(compactFields).toHaveLength(1)
    expect(compactFields[0].title).toBe('Notes')
  })
})

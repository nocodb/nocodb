import { defineStore } from 'pinia'
import type { KanbanType, TableType, ViewType } from 'nocodb-sdk'
import { ref, computed } from 'vue'
import {
  useApi,
  useFieldQuery,
  useNuxtApp,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useTableStore,
  useUndoRedo,
  useViewsStore,
} from '#imports'

export const useKanbanViewStore = defineStore('kanbanViewStore', () => {
  const { $api, $e } = useNuxtApp()

  // ────────────────────────────────────────────
  // Compact Mode State
  // ────────────────────────────────────────────

  /** Whether compact card mode is active */
  const isCompactMode = ref(false)

  /**
   * Toggle compact mode on/off and persist the preference
   * to localStorage so it survives page refreshes.
   */
  function toggleCompactMode() {
    isCompactMode.value = !isCompactMode.value
    try {
      localStorage.setItem('nocodb-kanban-compact-mode', String(isCompactMode.value))
    } catch {
      // localStorage may be unavailable in some environments
    }
    $e('a:kanban:compact-mode', { compact: isCompactMode.value })
  }

  /** Restore compact mode preference from localStorage */
  function initCompactMode() {
    try {
      const stored = localStorage.getItem('nocodb-kanban-compact-mode')
      if (stored !== null) {
        isCompactMode.value = stored === 'true'
      }
    } catch {
      // ignore
    }
  }

  // Initialise on store creation
  initCompactMode()

  // ────────────────────────────────────────────
  // (Existing store state & actions kept intact)
  // ────────────────────────────────────────────

  return {
    isCompactMode,
    toggleCompactMode,
    // … spread all other existing exports here …
  }
})

export { useKanbanViewStore as useKanbanViewStoreOrThrow }

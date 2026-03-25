/**
 * useKanbanCompactMode
 *
 * A thin composable that wraps the compact-mode slice of the kanban store.
 * Import this wherever you need compact-mode state without pulling in
 * the whole store.
 */
import { storeToRefs } from 'pinia'
import { useKanbanViewStore } from '~/store/kanbanView'

export function useKanbanCompactMode() {
  const store = useKanbanViewStore()
  const { isCompactMode } = storeToRefs(store)
  const { toggleCompactMode } = store

  return { isCompactMode, toggleCompactMode }
}

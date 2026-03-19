import { defineStore } from 'pinia'
import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import { useStorage } from '@vueuse/core'

export const useKanbanViewStore = defineStore('kanbanViewStore', () => {
  const isCompactMode = useStorage('kanban-compact-mode', false)

  function toggleCompactMode() {
    isCompactMode.value = !isCompactMode.value
  }

  return {
    isCompactMode,
    toggleCompactMode,
  }
})

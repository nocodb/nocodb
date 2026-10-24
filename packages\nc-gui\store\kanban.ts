import type { KanbanType, ViewType } from 'nocodb-sdk'
import { defineStore } from 'pinia'

// This would be the existing store with compactMode added
export const useKanbanViewStore = defineStore('kanbanViewStore', () => {
  // ... existing state
  const compactMode = ref(false)
  
  // ... existing methods
  
  return {
    // ... existing returns
    compactMode,
  }
})

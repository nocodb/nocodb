import type { KanbanType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useKanbanViewStore = defineStore('kanbanViewStore', () => {
  // ... existing code would be here
  
  const kanbanMetaData = ref<KanbanType>({})
  
  // compact mode getter
  const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)
  
  return {
    kanbanMetaData,
    isCompactMode,
    // ... other existing exports
  }
})

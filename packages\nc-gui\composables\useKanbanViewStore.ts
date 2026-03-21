import type { ColumnType, KanbanType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { Ref } from 'vue'

// Re-export with compact mode additions
const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    view: Ref<ViewType | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    // ... existing implementation ...
    
    // Add compact mode
    const isCompact = ref(false)
    
    function toggleCompact() {
      isCompact.value = !isCompact.value
    }
    
    return {
      // ... existing returns ...
      isCompact,
      toggleCompact,
    }
  }
)

import type { KanbanType, ViewType } from 'nocodb-sdk'
import { useInjectionState } from '@vueuse/core'
import { ref, computed } from 'vue'
import { useApi } from '#imports'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (meta: Ref<TableType | undefined>, viewMeta: Ref<ViewType | undefined>) => {
    // existing state...
    const isCompact = ref(false)
    
    const updateCompact = async (val: boolean) => {
      isCompact.value = val
      // persist to meta
    }
    
    return {
      isCompact,
      updateCompact,
    }
  }
)

export { useProvideKanbanViewStore, useKanbanViewStore }

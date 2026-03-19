import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { GROUP_BY_VARS, ref, useInjectionState } from '#imports'

const [useProvideKanbanViewStore, useKanbanViewStoreOrThrow] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<ViewType | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const { t } = useI18n()

    const { api } = useApi()

    const { $e } = useNuxtApp()

    const { statuses } = storeToRefs(useViewsStore())

    const { addUndo, defineViewScope } = useUndoRedo()

    const isPublic = inject(IsPublicInj, ref(false))

    const { isUIAllowed } = useRoles()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData } = useSharedView()

    const { metas, getMeta } = useMetas()

    const kanbanMetaData = ref<KanbanType>({})

    const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

    // ... rest of implementation

    async function updateKanbanMeta(updateObj: Partial<KanbanType & { compact_mode?: boolean }>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      kanbanMetaData.value = {
        ...(kanbanMetaData.value ?? {}),
        ...updateObj,
      }
      await api.dbView.kanbanUpdate(viewMeta.value.id, kanbanMetaData.value as KanbanType)
    }

    return {
      kanbanMetaData,
      isCompactMode,
      updateKanbanMeta,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStore() {
  const store = useKanbanViewStoreOrThrow()
  if (!store) {
    throw new Error('Kanban view store is not provided')
  }
  return store
}

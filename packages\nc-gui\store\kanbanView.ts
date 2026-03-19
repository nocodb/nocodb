import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

const GROUP_BY_VARS = {
  NULL: '__nc_null__',
}

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

    const { addUndo, defineViewScope } = useUndoRedo()

    const isPublic = inject(IsPublicInj, ref(false))

    const { isUIAllowed } = useRoles()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { sharedView, fetchSharedViewData } = useSharedView()

    const { metas, getMeta } = useMetas()

    const kanbanMetaData = ref<KanbanType>({})

    const groupingField = ref<string>('')

    const groupingFieldColumn = ref<ColumnType | undefined>()

    const kanbanViewCoverImageColumnId = ref<string>()

    const activeView = inject(ActiveViewInj, ref())

    const { search } = useFieldQuery()

    const formattedData = ref<Map<string | null | undefined, Row[]>>(new Map())

    const countByStack = ref<Map<string | null | undefined, number>>(new Map())

    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])

    const nGroupingFieldsNull = ref(0)

    // compact mode - derive from meta data
    const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      const res: KanbanType = isPublic.value
        ? (sharedView.value?.view as KanbanType)
        : await api.dbView.kanbanRead(viewMeta.value.id)
      // ...existing meta loading logic
      kanbanMetaData.value = res
      kanbanViewCoverImageColumnId.value = res.fk_cover_image_col_id || undefined
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      kanbanMetaData.value = {
        ...(kanbanMetaData.value ?? {}),
        ...updateObj,
      }
      await api.dbView.kanbanUpdate(viewMeta.value.id, kanbanMetaData.value)
    }

    return {
      // ...existing returns
      kanbanMetaData,
      isCompactMode,
      kanbanViewCoverImageColumnId,
      updateKanbanMeta,
      loadKanbanMeta,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStore() {
  const store = useKanbanViewStoreOrThrow()
  if (store == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')
  return store
}

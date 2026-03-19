import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

type Row = {
  row: Record<string, any>
  oldRow: Record<string, any>
  rowMeta: Record<string, any>
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

    const kanbanMetaData = ref<KanbanType & { compact_mode?: boolean }>({})

    const groupingField = ref<string>('')
    const groupingFieldColumn = ref<ColumnType | undefined>()
    const kanbanViewCoverImageColumnId = ref<string>()
    const formattedData = ref<Map<string | null | undefined, Row[]>>(new Map())
    const countByStack = ref<Map<string | null | undefined, number>>(new Map())
    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])
    const nGroupingFieldsNull = ref(0)

    const isCompactMode = computed(() => !!kanbanMetaData.value?.compact_mode)

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      const res: KanbanType & { compact_mode?: boolean } = isPublic.value
        ? (sharedView.value?.view as KanbanType)
        : await api.dbView.kanbanRead(viewMeta.value.id)
      kanbanMetaData.value = res
      kanbanViewCoverImageColumnId.value = res.fk_cover_image_col_id || undefined

      const groupingFieldId = res.fk_grp_col_id
      const col = meta.value?.columns?.find((f: ColumnType) => f.id === groupingFieldId)
      groupingField.value = col?.title || ''
      groupingFieldColumn.value = col
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType & { compact_mode?: boolean }>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      kanbanMetaData.value = {
        ...(kanbanMetaData.value ?? {}),
        ...updateObj,
      }
      await api.dbView.kanbanUpdate(viewMeta.value.id, kanbanMetaData.value as KanbanType)
    }

    // ... other functions remain unchanged

    return {
      formattedData,
      countByStack,
      groupingField,
      groupingFieldColumn,
      groupingFieldColOptions,
      kanbanMetaData,
      kanbanViewCoverImageColumnId,
      isCompactMode,
      nGroupingFieldsNull,
      loadKanbanMeta,
      updateKanbanMeta,
      // ... other returns
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

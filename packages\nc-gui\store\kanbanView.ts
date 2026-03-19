import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

type RowType = Row

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
    const formattedData = ref<Map<string | null | undefined, RowType[]>>(new Map())
    const countByStack = ref<Map<string | null | undefined, number>>(new Map())
    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])
    const nGroupingFieldsNull = ref(0)

    // Compact mode - stored in kanban meta
    const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      const res: KanbanType = isPublic.value
        ? (sharedView.value?.view as KanbanType)
        : await api.dbView.kanbanRead(viewMeta.value.id)
      // res.fk_grp_col_id is the grouping field column id
      kanbanMetaData.value = res
      kanbanViewCoverImageColumnId.value = res.fk_cover_image_col_id || undefined

      const groupingFieldId = res.fk_grp_col_id
      const col = meta.value?.columns?.find((f: ColumnType) => f.id === groupingFieldId)
      groupingField.value = col?.title || ''
      groupingFieldColumn.value = col
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      kanbanMetaData.value = {
        ...(kanbanMetaData.value ?? {}),
        ...updateObj,
      }
      await api.dbView.kanbanUpdate(viewMeta.value.id, kanbanMetaData.value)
    }

    async function loadKanbanData() {
      if ((!isPublic.value && !viewMeta.value?.id) || !meta.value?.id) return
      // load data for all stacks
    }

    function addEmptyRow(stackTitle?: string | null, at = -1) {
      const stack = formattedData.value.get(stackTitle)
      if (!stack) return
      const newRow: RowType = {
        row: { [groupingField.value]: stackTitle },
        oldRow: {},
        rowMeta: { new: true },
      }
      if (at === -1) {
        stack.push(newRow)
      } else {
        stack.splice(at, 0, newRow)
      }
      return newRow
    }

    async function updateOrSaveRow(row: RowType) {
      // handle update/save
    }

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
      loadKanbanData,
      updateKanbanMeta,
      addEmptyRow,
      updateOrSaveRow,
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

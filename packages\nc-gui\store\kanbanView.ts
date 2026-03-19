import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { useInjectionState } from '#imports'

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

    const activeView = inject(ActiveViewInj, ref())

    const formattedData = ref<Map<string | null | undefined, RowType[]>>(new Map())

    const countByStack = ref<Map<string | null | undefined, number>>(new Map())

    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])

    const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

    const nGroupingFieldsNull = ref(0)

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      const res = isPublic.value
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

    async function loadKanbanData() {
      if ((!isPublic.value && !viewMeta.value?.id) || !meta.value?.id) return

      // Implementation for loading kanban data
    }

    function addEmptyRow(stackTitle: string | null | undefined, at = -1) {
      const stack = formattedData.value.get(stackTitle)
      if (!stack) return
      const newRow: RowType = {
        row: {
          [groupingField.value]: stackTitle,
        },
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
      if (row.rowMeta.new) {
        // Save new row
      } else {
        // Update existing row
      }
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
  if (!store) {
    throw new Error('Kanban view store is not provided')
  }
  return store
}

import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

const GROUP_BY_VARS = { NULL: '__nc_null__' }

const [useProvideKanbanViewStore, useKanbanViewStoreOrThrow] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<ViewType | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    const { t } = useI18n()
    const { api } = useApi()
    const { $e } = useNuxtApp()
    const { addUndo, defineViewScope } = useUndoRedo()
    const isPublic = inject(IsPublicInj, ref(false))
    const { isUIAllowed } = useRoles()
    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()
    const { sharedView, fetchSharedViewData } = useSharedView()

    const kanbanMetaData = ref<KanbanType>({})
    const groupingField = ref<string>('')
    const groupingFieldColumn = ref<ColumnType | undefined>()
    const kanbanViewCoverImageColumnId = ref<string>()
    const formattedData = ref<Map<string | null | undefined, Row[]>>(new Map())
    const countByStack = ref<Map<string | null | undefined, number>>(new Map())
    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])
    const nGroupingFieldsNull = ref(0)
    const { search } = useFieldQuery()

    // NEW: compact mode support
    const isCompactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.columns) return
      const res: KanbanType = isPublic.value
        ? (sharedView.value?.view as KanbanType)
        : await api.dbView.kanbanRead(viewMeta.value.id)
      kanbanMetaData.value = res
      kanbanViewCoverImageColumnId.value = res.fk_cover_image_col_id || undefined
      const col = meta.value?.columns?.find((f: ColumnType) => f.id === res.fk_grp_col_id)
      groupingField.value = col?.title || ''
      groupingFieldColumn.value = col
      
      const groupingFieldVal = await api.dbTableColumn.list(meta.value!.id!)
      // set up grouping field column options
      groupingFieldColOptions.value = (
        (groupingFieldColumn.value?.colOptions as any)?.options ?? []
      ).map((option: SelectOptionType) => ({
        ...option,
        collapsed: false,
      }))
      groupingFieldColOptions.value.push({
        id: GROUP_BY_VARS.NULL,
        title: `${t('general.uncategorized')}`,
        order: groupingFieldColOptions.value.length,
        color: '#999',
        collapsed: !!(res as any).collapsed_stacks?.includes(GROUP_BY_VARS.NULL),
      })
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || !isUIAllowed('dataEdit')) return
      kanbanMetaData.value = {
        ...(kanbanMetaData.value ?? {}),
        ...updateObj,
      }
      await api.dbView.kanbanUpdate(viewMeta.value.id, kanbanMetaData.value)
    }

    async function updateOrSaveRow(row: Row, property?: string) {
      if (row.rowMeta.new) {
        const insertedData = await api.dbViewRow.create(
          NOCO,
          meta.value?.id ?? '',
          viewMeta.value?.id ?? '',
          { ...row.row, ...row.rowMeta },
          { where: where?.value },
        )
        Object.assign(row.row, insertedData)
        Object.assign(row.oldRow, insertedData)
        row.rowMeta.new = false
      } else {
        await api.dbViewRow.update(
          NOCO,
          meta.value?.id ?? '',
          viewMeta.value?.id ?? '',
          row.row.Id,
          property ? { [property]: row.row[property] } : row.row,
          { where: where?.value },
        )
        Object.assign(row.oldRow, row.row)
      }
    }

    async function loadKanbanData() {
      if ((!isPublic.value && !viewMeta.value?.id) || !meta.value?.id) return
      // load all stack data
    }

    function addEmptyRow(stackTitle?: string | null, at = -1) {
      const stack = formattedData.value.get(stackTitle)
      if (!stack) return
      const newRow: Row = {
        row: {
          [groupingField.value]: stackTitle === GROUP_BY_VARS.NULL ? null : stackTitle,
        },
        oldRow: {},
        rowMeta: { new: true, selected: false, isValidationFailed: false },
      }
      if (at === -1) {
        stack.push(newRow)
      } else {
        stack.splice(at, 0, newRow)
      }
      return newRow
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
      updateOrSaveRow,
      addEmptyRow,
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

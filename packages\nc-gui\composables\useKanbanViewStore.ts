import type { AttachmentType, ColumnType, KanbanType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { Row } from '../lib/types'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    view: Ref<ViewType | undefined>,
    shared = false,
    where?: ComputedRef<string | undefined>,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const { t } = useI18n()

    const { api } = useApi()

    const { $e } = useNuxtApp()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const isPublic = ref(shared)

    const { sharedView } = useSharedView()

    const { isUIAllowed } = useRoles()

    const { getMeta } = useMetas()

    const { addUndo, defineViewScope } = useUndoRedo()

    const { fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()

    const activeRow = ref<Row>()

    const kanbanMetaData = ref<KanbanType>({})

    const formattedData = ref<Map<string, Row[]>>(new Map())

    const countByStack = ref<Map<string, number>>(new Map())

    const stackMetaObj = ref<Record<string, Record<string, any>>>({})

    const kanbanStackMeta = ref<Record<string, any>>({})

    const groupingField = ref<ColumnType | undefined>()

    const groupingFieldColumn = ref<ColumnType | undefined>()

    const loadMoreDone = ref<Map<string, boolean>>(new Map())

    const { isPaginationLoading } = useViewData(meta, view, where)

    /** Toggle between compact and default card layout */
    const isCompact = ref(false)

    const fields = inject(FieldsInj, ref([]))

    const groupingFieldValue = computed(() => {
      return groupingFieldColumn?.value?.title
    })

    const coverImageField = computed<ColumnType | undefined>(() => {
      const col = meta.value?.columns?.find((c) => c.id === kanbanMetaData.value.fk_cover_image_col_id)
      return col
    })

    const hiddenFields = computed(() => {
      return fields.value.filter((f) => f.hidden)
    })

    const displayField = computed(() => {
      return fields.value.find((f) => f.pv)
    })

    /**
     * Toggle compact card mode on the kanban board.
     * In compact mode, cards take minimal vertical space.
     */
    function toggleCompact() {
      isCompact.value = !isCompact.value
      $e('c:kanban:compact-mode', { compact: isCompact.value })
    }

    async function loadKanbanMeta() {
      if (!view.value?.id || !meta?.value?.id) return

      kanbanMetaData.value = await api.dbView.kanbanRead(view.value.id)

      const groupingFieldId = kanbanMetaData.value.fk_grp_col_id
      if (groupingFieldId) {
        groupingFieldColumn.value = meta.value?.columns?.find((c) => c.id === groupingFieldId)
      }

      const stackMeta = kanbanMetaData.value?.meta
      stackMetaObj.value = stackMeta ? (typeof stackMeta === 'string' ? JSON.parse(stackMeta) : stackMeta) : {}
    }

    async function loadKanbanData() {
      if ((!isPublic.value && !meta?.value?.id) || !view.value?.id) return
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!isPublic.value && !meta?.value?.id) || !view.value?.id) return

      const _where = `(${groupingFieldValue.value},${stackTitle === 'uncategorized' ? 'is,null' : `eq,${stackTitle}`})`

      const response = isPublic.value
        ? await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })
        : await api.dbViewRow.list('noco', meta.value!.base_id!, meta.value!.id!, view.value!.id!, {
            ...params,
            where: params?.where ? `${_where}~and${params.where}` : _where,
          })

      const data = (response as any).list ?? []
      const existingData = formattedData.value.get(stackTitle) ?? []
      formattedData.value.set(stackTitle, [...existingData, ...data])
      countByStack.value.set(stackTitle, (response as any).pageInfo?.totalRows ?? 0)
    }

    async function updateKanbanStackMeta(updateObj: Record<string, any>) {
      const newStackMeta = { ...stackMetaObj.value, ...updateObj }
      stackMetaObj.value = newStackMeta
      if (isUIAllowed('dataEdit') && !isPublic.value) {
        await updateKanbanMeta({ meta: newStackMeta })
      }
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!view.value?.id || isPublic.value) return
      await api.dbView.kanbanUpdate(view.value.id, updateObj)
    }

    async function addEmptyRow(stackTitle: string, stackIdx: number) {
      const existingData = formattedData.value.get(stackTitle) ?? []
      const newRow: Row = {
        row: { [groupingFieldValue.value!]: stackTitle === 'uncategorized' ? null : stackTitle },
        oldRow: {},
        rowMeta: { new: true },
      }
      formattedData.value.set(stackTitle, [...existingData, newRow])
    }

    async function deleteStack(stackTitle: string, stackIdx: number) {
      formattedData.value.delete(stackTitle)
      countByStack.value.delete(stackTitle)
    }

    return {
      kanbanMetaData,
      formattedData,
      countByStack,
      stackMetaObj,
      groupingField,
      groupingFieldColumn,
      groupingFieldValue,
      loadKanbanData,
      loadMoreKanbanData,
      loadKanbanMeta,
      updateKanbanStackMeta,
      updateKanbanMeta,
      fields,
      coverImageField,
      hiddenFields,
      displayField,
      addEmptyRow,
      deleteStack,
      kanbanStackMeta,
      loadMoreDone,
      isPaginationLoading,
      isCompact,
      toggleCompact,
      activeRow,
    }
  },
)

export { useProvideKanbanViewStore }
export { useKanbanViewStore }

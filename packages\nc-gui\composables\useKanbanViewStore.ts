import type { AttachmentType, ColumnType, KanbanType, SelectOptionsType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

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

    // Compact mode - makes cards take minimal vertical space
    const isCompact = ref(false)

    const groupingFieldValue = computed(() => {
      return groupingFieldColumn?.value?.title
    })

    const fields = inject(FieldsInj, ref([]))

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

    const { isPaginationLoading } = useViewData(meta, view, where)

    const kanbanStacks = computed<Row[][]>(() => {
      if (!groupingFieldColumn.value?.colOptions) return []
      const colOptions = groupingFieldColumn.value.colOptions as SelectOptionsType
      const stacks = []
      for (const option of [{ id: 'uncategorized', title: null }, ...(colOptions.options ?? [])]) {
        stacks.push(formattedData.value.get(option.title as string) ?? [])
      }
      return stacks
    })

    const countByStackComputed = computed(() => countByStack.value)

    async function loadKanbanData() {
      if ((!isPublic.value && !meta?.value?.id) || !view.value?.id) return

      const params: Parameters<Api<any>['dbViewRow']['list']>[4] = {
        where: where?.value,
      }

      await Promise.all([loadKanbanMeta(), loadKanbanStacks(params)])
    }

    async function loadKanbanMeta() {
      if (!view.value?.id || !meta?.value?.id) return

      const res = await api.dbView.kanbanRead(view.value.id)
      kanbanMetaData.value = res

      const groupingFieldId = kanbanMetaData.value.fk_grp_col_id
      if (groupingFieldId) {
        groupingFieldColumn.value = meta.value?.columns?.find((c) => c.id === groupingFieldId)
      }
    }

    async function loadKanbanStacks(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!isPublic.value && !meta?.value?.id) || !view.value?.id) return

      await Promise.all(
        [...(formattedData.value.keys() || [])].map((stackTitle) => loadMoreKanbanData(stackTitle, { ...params, where: where?.value })),
      )
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      if ((!isPublic.value && !meta?.value?.id) || !view.value?.id) return

      let where = `(${groupingFieldValue.value},eq,${stackTitle})`

      if (params?.where) {
        where = `${where}~and${params.where}`
      }

      const response = isPublic.value
        ? await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })
        : await api.dbViewRow.list('noco', meta.value!.base_id!, meta.value!.id!, view.value!.id!, {
            ...params,
            where,
          })

      const data = (response as any).list ?? []
      const existingData = formattedData.value.get(stackTitle) ?? []

      formattedData.value.set(stackTitle, [...existingData, ...data])
      countByStack.value.set(stackTitle, (response as any).pageInfo?.totalRows ?? 0)
    }

    async function updateKanbanStackMeta(updateObj: Record<string, any>) {
      const newStackMeta = {
        ...stackMetaObj.value,
        ...updateObj,
      }
      stackMetaObj.value = newStackMeta
      if (isUIAllowed('dataEdit') && !isPublic.value) {
        await updateKanbanMeta({
          meta: newStackMeta,
        })
      }
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!view.value?.id || isPublic.value) return
      await api.dbView.kanbanUpdate(view.value.id, updateObj)
    }

    function toggleCompact() {
      isCompact.value = !isCompact.value
      $e('c:kanban:compact-mode', { isCompact: isCompact.value })
    }

    async function addEmptyRow(stackTitle: string, stackIdx: number) {
      const existingData = formattedData.value.get(stackTitle) ?? []

      const newRow = {
        row: {
          [groupingFieldValue.value!]: stackTitle === 'uncategorized' ? null : stackTitle,
        },
        oldRow: {},
        rowMeta: {
          new: true,
        },
      }

      formattedData.value.set(stackTitle, [...existingData, newRow])
    }

    async function deleteStack(stackTitle: string, stackIdx: number) {
      // Remove stack data
      formattedData.value.delete(stackTitle)
      countByStack.value.delete(stackTitle)
    }

    return {
      kanbanMetaData,
      formattedData,
      countByStack: countByStackComputed,
      stackMetaObj,
      groupingField,
      groupingFieldColumn,
      groupingFieldValue,
      loadKanbanData,
      loadMoreKanbanData,
      loadKanbanMeta,
      updateKanbanStackMeta,
      kanbanStacks,
      fields,
      coverImageField,
      hiddenFields,
      displayField,
      addEmptyRow,
      deleteStack,
      updateKanbanMeta,
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

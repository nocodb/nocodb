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

    const isPublic = ref(shared)
    const { sharedView } = useSharedView()
    const { isUIAllowed } = useRoles()
    const { isPaginationLoading } = useViewData(meta, view, where)

    const { getMeta } = useMetas()

    const { addUndo, defineViewScope } = useUndoRedo()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

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

    // Compact mode state - persisted per view
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
      // Implementation for loading kanban data
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
      // Implementation for loading more kanban data
    }

    async function loadKanbanMeta() {
      if (!view.value?.id || !meta?.value?.id) return
      // Implementation for loading kanban meta
    }

    async function updateKanbanStackMeta(updateObj: Record<string, any>) {
      // Implementation for updating kanban stack meta
    }

    function toggleCompact() {
      isCompact.value = !isCompact.value
      $e('c:kanban:compact-mode', { isCompact: isCompact.value })
    }

    async function deleteStack(stackTitle: string, stackIdx: number) {
      // Implementation for deleting stack
    }

    async function addEmptyRow(stackTitle: string, stackIdx: number) {
      // Implementation for adding empty row
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      // Implementation for updating kanban meta
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

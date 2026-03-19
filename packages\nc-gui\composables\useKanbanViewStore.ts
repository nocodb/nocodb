import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isSystemColumn } from 'nocodb-sdk'
import type { Row } from '../lib/types'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    viewMeta: Ref<ViewType | KanbanType | undefined> | ComputedRef<ViewType | KanbanType | undefined>,
    shared = false,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const { t } = useI18n()

    const { api } = useApi()

    const { $e } = useNuxtApp()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { isUIAllowed } = useRoles()

    const globalGroupByGroupLimit = ref(1000)

    const { getMeta } = useMetas()

    const cacheSize = 10 * 1024 * 1024 // 10 MB
    const cacheEvictDuration = 5 * 60 * 1000 // 5 min

    const activeView = inject(ActiveViewInj, ref())

    const { changePage } = useViewPaginationInj()

    const { addUndo, defineViewScope } = useUndoRedo()

    const router = useRouter()

    const route = router.currentRoute

    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))

    const { base: activeBase } = storeToRefs(useBase())

    const { basesUser } = storeToRefs(useUsers())

    // kanban stack meta data
    const kanbanMetaData = ref<KanbanType>({})

    // grouping field column id
    const groupingFieldColId = ref<string | undefined>()

    // grouping field title
    const groupingField = ref<string | undefined>()

    // grouping field column
    const groupingFieldColumn = ref<ColumnType | undefined>()

    // stack records grouped by grouping field
    const groupingFieldColumnOptions = ref<Array<SelectOptionType & { collapsed: boolean }>>([])

    // map of grouping field options to stacks
    const formattedData = ref<Map<string, Row[]>>(new Map<string, Row[]>())

    // map of grouping field options to row count
    const countByStack = ref<Map<string, number>>(new Map<string, number>())

    // options to collapsed/uncollapsed stacks
    const collapsedStack = ref<boolean[]>([])

    const { isMobileMode } = useGlobal()

    const { search } = useFieldQuery()

    const isCompactMode = ref(false)

    const fields = inject(FieldsInj, ref([]))

    const fieldsById = computed<Record<string, ColumnType>>(() => {
      return fields.value.reduce((acc, field) => {
        acc[field.id!] = field
        return acc
      }, {} as Record<string, ColumnType>)
    })

    const { isPaginationLoading } = usePaginationDataStoreOrThrow()

    const hasScrollingColumns = ref(false)

    const scrollingColumns = ref<Set<string>>(new Set())

    const isLoading = ref(false)

    const reloadAggregate = inject(ReloadAggregateHookInj)

    const $api = api

    const editEnabled = ref<boolean[]>([])

    const isAddingColumnAllowed = ref(false)
    const isAddingRowAllowed = ref(false)

    let saveTimeout: NodeJS.Timeout | null = null

    const selectedDate = ref<Date | null>(null)

    const currentPage = ref<Map<string, number>>(new Map<string, number>())

    const lastGetDataParams = ref<Map<string, any>>(new Map<string, any>())

    // toggle compact mode
    function toggleCompactMode() {
      isCompactMode.value = !isCompactMode.value
    }

    async function loadKanbanData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id || !groupingFieldColId.value) && !isPublic.value) {
        return
      }
    }

    async function loadMoreKanbanData(stackTitle: string, params: Parameters<Api<any>['dbViewRow']['list']>[3] = {}) {}

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return
      kanbanMetaData.value = isPublic.value
        ? (viewMeta.value as KanbanType)
        : await $api.dbView.kanbanRead(viewMeta.value.id)
      // set grouping field
      groupingFieldColId.value = kanbanMetaData.value.fk_grp_col_id || undefined
    }

    async function updateKanbanStackMeta(updateObj: Partial<KanbanType>) {
      if (isPublic.value) return
      kanbanMetaData.value = {
        ...kanbanMetaData.value,
        ...updateObj,
      }
      await $api.dbView.kanbanUpdate(viewMeta.value!.id!, kanbanMetaData.value)
    }

    function addEmptyRow(addAfter = formattedData.value.get(null as any)?.length) {
      return {}
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || isPublic.value) return
      await $api.dbView.kanbanUpdate(viewMeta.value.id, updateObj)
    }

    return {
      loadKanbanData,
      loadMoreKanbanData,
      loadKanbanMeta,
      updateKanbanStackMeta,
      updateKanbanMeta,
      groupingFieldColId,
      groupingField,
      groupingFieldColumn,
      groupingFieldColumnOptions,
      formattedData,
      countByStack,
      collapsedStack,
      kanbanMetaData,
      addEmptyRow,
      isLoading,
      isCompactMode,
      toggleCompactMode,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStore() {
  const state = useInjectionState('kanban-view-store')
  if (!state) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')
  return state
}

import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'

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

    const { isMobileMode } = useGlobal()

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

    // stack options
    const groupingFieldColumnOptions = ref<Array<SelectOptionType & { collapsed: boolean }>>([])

    // map of grouping field options to stacks
    const formattedData = ref<Map<string, Row[]>>(new Map<string, Row[]>())

    // map of grouping field options to row count
    const countByStack = ref<Map<string, number>>(new Map<string, number>())

    // collapsed stacks
    const collapsedStack = ref<boolean[]>([])

    const { search } = useFieldQuery()

    // compact mode state for kanban cards
    const isCompactMode = ref(false)

    const fields = inject(FieldsInj, ref([]))

    const fieldsById = computed<Record<string, ColumnType>>(() => {
      return fields.value.reduce((acc, field) => {
        acc[field.id!] = field
        return acc
      }, {} as Record<string, ColumnType>)
    })

    const isLoading = ref(false)

    const $api = api

    const editEnabled = ref<boolean[]>([])

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return
      kanbanMetaData.value = isPublic.value
        ? (viewMeta.value as KanbanType)
        : await $api.dbView.kanbanRead(viewMeta.value.id)
      // set grouping field
      groupingFieldColId.value = kanbanMetaData.value.fk_grp_col_id || undefined
    }

    async function loadKanbanData() {
      if ((!activeBase?.value?.id || !meta.value?.id || !viewMeta.value?.id || !groupingFieldColId.value) && !isPublic.value) {
        return
      }
    }

    async function loadMoreKanbanData(stackTitle: string, params: Record<string, any> = {}) {}

    async function updateKanbanStackMeta(updateObj: Partial<KanbanType>) {
      if (isPublic.value) return
      kanbanMetaData.value = {
        ...kanbanMetaData.value,
        ...updateObj,
      }
      await $api.dbView.kanbanUpdate(viewMeta.value!.id!, kanbanMetaData.value)
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || isPublic.value) return
      await $api.dbView.kanbanUpdate(viewMeta.value.id, updateObj)
    }

    function addEmptyRow(addAfter = formattedData.value.get(null as any)?.length) {
      return {}
    }

    // Toggle compact mode for kanban cards
    function toggleCompactMode() {
      isCompactMode.value = !isCompactMode.value
      $e('a:kanban:compact-mode', { enabled: isCompactMode.value })
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
      editEnabled,
      fields,
      fieldsById,
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

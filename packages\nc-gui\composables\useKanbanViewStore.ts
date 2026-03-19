import type { ComputedRef, Ref } from 'vue'
import type { Api, ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'

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
    const { isMobileMode } = useGlobal()
    const router = useRouter()
    const isPublic = ref(shared) || inject(IsPublicInj, ref(false))
    const { base: activeBase } = storeToRefs(useBase())

    const kanbanMetaData = ref<KanbanType>({})
    const groupingFieldColId = ref<string | undefined>()
    const groupingField = ref<string | undefined>()
    const groupingFieldColumn = ref<ColumnType | undefined>()
    const groupingFieldColumnOptions = ref<Array<SelectOptionType & { collapsed: boolean }>>([])
    const formattedData = ref<Map<string, Row[]>>(new Map<string, Row[]>())
    const countByStack = ref<Map<string, number>>(new Map<string, number>())
    const collapsedStack = ref<boolean[]>([])
    const isLoading = ref(false)
    const editEnabled = ref<boolean[]>([])
    const fields = inject(FieldsInj, ref([]))

    // Compact mode for kanban cards - shows only primary field in minimal height
    const isCompactMode = ref(false)

    const fieldsById = computed<Record<string, ColumnType>>(() => {
      return fields.value.reduce(
        (acc, field) => {
          acc[field.id!] = field
          return acc
        },
        {} as Record<string, ColumnType>,
      )
    })

    const $api = api

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return
      kanbanMetaData.value = isPublic.value
        ? (viewMeta.value as KanbanType)
        : await $api.dbView.kanbanRead(viewMeta.value.id)
      groupingFieldColId.value = kanbanMetaData.value.fk_grp_col_id || undefined
    }

    async function loadKanbanData() {}

    async function loadMoreKanbanData(stackTitle: string, params: Record<string, any> = {}) {}

    async function updateKanbanStackMeta(updateObj: Partial<KanbanType>) {
      if (isPublic.value) return
      kanbanMetaData.value = { ...kanbanMetaData.value, ...updateObj }
      await $api.dbView.kanbanUpdate(viewMeta.value!.id!, kanbanMetaData.value)
    }

    async function updateKanbanMeta(updateObj: Partial<KanbanType>) {
      if (!viewMeta?.value?.id || isPublic.value) return
      await $api.dbView.kanbanUpdate(viewMeta.value.id, updateObj)
    }

    function addEmptyRow(addAfter = formattedData.value.get(null as any)?.length) {
      return {}
    }

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

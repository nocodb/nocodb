import { message } from 'ant-design-vue'
import type { ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { Row as RowType } from '~/lib/types'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | undefined>,
    viewMeta: Ref<ViewType & { id: string }> | ComputedRef<ViewType & { id: string }>,
    shared = false,
  ) => {
    if (!meta) {
      throw new Error('Table meta is not available')
    }

    const isPublic = inject(IsPublicInj, ref(false))

    const { t } = useI18n()

    const { api } = useApi()

    const { base } = useBase()

    const { $e, $api } = useNuxtApp()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const { isUIAllowed } = useRoles()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const groupingField = ref<string>('')

    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])

    const groupingFieldColumn = ref<ColumnType | undefined>()

    const stackMetaObj = ref<Record<string, Record<string, any>>>({})

    const formattedData = ref<Map<string, RowType[]>>(new Map<string, RowType[]>())

    const countByStack = ref<Map<string, number>>(new Map<string, number>())

    const groupingFieldTitleRef = ref<string>('')

    const loadedStacksRef = ref<Set<string>>(new Set())

    const activeStackId = ref<string>('')

    const loadMoreLoadingStack = ref<string | null>(null)

    const kanbanMetaData = ref<KanbanType>({})

    const hasMore = ref<Map<string, boolean>>(new Map<string, boolean>())

    const isRowsLoading = ref<boolean>(false)

    // Compact mode for kanban cards
    const isCompactMode = ref<boolean>(false)

    const PAGE_SIZE = 25

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return

      kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)

      const groupingFieldId = kanbanMetaData.value.fk_grp_col_id!
      const col = meta.value?.columns?.find((f) => f.id === groupingFieldId)
      groupingFieldColumn.value = col
      groupingField.value = col?.title || ''

      const gfMeta = await $api.dbTableColumn.read(groupingFieldId!)
      groupingFieldColOptions.value = (gfMeta?.colOptions?.options || []).map(
        (o: SelectOptionType) => ({ ...o, collapsed: false }),
      )
      stackMetaObj.value = parseProp(kanbanMetaData.value.meta)

      // Restore compact mode from persisted meta
      if (stackMetaObj.value?.isCompactMode !== undefined) {
        isCompactMode.value = !!stackMetaObj.value.isCompactMode
      }

      if (!stackMetaObj.value || !Object.keys(stackMetaObj.value).length) {
        await updateKanbanStackMeta()
      }
    }

    async function updateKanbanStackMeta() {
      if (!viewMeta.value?.id) return

      const kanbanMeta = {
        ...stackMetaObj.value,
        isCompactMode: isCompactMode.value,
      }
      stackMetaObj.value = kanbanMeta

      await $api.dbView.kanbanUpdate(viewMeta.value.id, {
        meta: kanbanMeta,
      })
    }

    async function toggleCompactMode() {
      isCompactMode.value = !isCompactMode.value
      try {
        await updateKanbanStackMeta()
      } catch (e: any) {
        console.error(e)
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    async function loadKanbanData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
    }

    return {
      groupingField,
      groupingFieldColOptions,
      groupingFieldColumn,
      stackMetaObj,
      formattedData,
      countByStack,
      groupingFieldTitleRef,
      loadedStacksRef,
      activeStackId,
      loadMoreLoadingStack,
      kanbanMetaData,
      hasMore,
      isRowsLoading,
      isCompactMode,
      loadKanbanMeta,
      loadKanbanData,
      updateKanbanStackMeta,
      toggleCompactMode,
    }
  },
  'use-kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')

  return kanbanViewStore
}

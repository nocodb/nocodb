import { message } from 'ant-design-vue'
import type { ColumnType, KanbanType, SelectOptionType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { Row as RowType } from '~/lib/types'
import { IsPublicInj, MetaInj, ReloadViewDataHookInj } from '~/lib/inject'

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

    const { isUIAllowed } = useRoles()

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const groupingField = ref('')

    const groupingFieldColOptions = ref<(SelectOptionType & { collapsed: boolean })[]>([])

    const groupingFieldColumn = ref<ColumnType | undefined>()

    const stackMetaObj = ref<Record<string, any>>({})

    const formattedData = ref<Map<string, RowType[]>>(new Map())

    const countByStack = ref<Map<string, number>>(new Map())

    const groupingFieldTitleRef = ref('')

    const loadedStacksRef = ref<Set<string>>(new Set())

    const activeStackId = ref('')

    const loadMoreLoadingStack = ref<string | null>(null)

    const kanbanMetaData = ref<KanbanType>({})

    const hasMore = ref<Map<string, boolean>>(new Map())

    const isRowsLoading = ref(false)

    const collapseStack = ref<Map<string, boolean>>(new Map())

    // Compact mode - shows cards in a single-line compact format
    const isCompactMode = ref(false)

    const PAGE_SIZE = 25

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return

      kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)

      const groupingFieldId = kanbanMetaData.value.fk_grp_col_id!
      const col = meta.value?.columns?.find((f) => f.id === groupingFieldId)
      groupingFieldColumn.value = col
      groupingField.value = col?.title || ''
      groupingFieldTitleRef.value = col?.title || ''

      const gfMeta = await $api.dbTableColumn.read(groupingFieldId!)
      groupingFieldColOptions.value = (gfMeta?.colOptions?.options || []).map(
        (o: SelectOptionType) => ({
          ...o,
          collapsed: false,
        }),
      )

      stackMetaObj.value = parseProp(kanbanMetaData.value.meta) || {}

      // Restore compact mode preference
      if (typeof stackMetaObj.value.isCompactMode === 'boolean') {
        isCompactMode.value = stackMetaObj.value.isCompactMode
      }
    }

    async function updateKanbanStackMeta(updateObj?: Record<string, any>) {
      if (!viewMeta.value?.id) return

      const updatedMeta = {
        ...stackMetaObj.value,
        ...updateObj,
        isCompactMode: isCompactMode.value,
      }

      stackMetaObj.value = updatedMeta

      await $api.dbView.kanbanUpdate(viewMeta.value.id, {
        meta: updatedMeta,
      })
    }

    async function toggleCompactMode() {
      isCompactMode.value = !isCompactMode.value
      await updateKanbanStackMeta()
    }

    async function loadKanbanData() {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return

      isRowsLoading.value = true
      try {
        await Promise.all([
          // load uncategorized
          loadKanbanDataForStack(null),
          // load each option stack
          ...groupingFieldColOptions.value.map((option) =>
            loadKanbanDataForStack(option.title),
          ),
        ])
      } catch (e: any) {
        console.error(e)
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isRowsLoading.value = false
      }
    }

    async function loadKanbanDataForStack(stackTitle: string | null) {
      if (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) return

      const stackKey = stackTitle ?? 'uncategorized'
      const whereClause = stackTitle
        ? `(${groupingField.value},eq,${stackTitle})`
        : `(${groupingField.value},is,null)`

      const response = await api.dbViewRow.list(
        'noco',
        base.value.id!,
        meta.value.id!,
        viewMeta.value.id,
        {
          limit: PAGE_SIZE,
          where: whereClause,
        } as any,
      )

      formattedData.value.set(
        stackKey,
        response.list.map((r: any) => ({
          row: { ...r },
          oldRow: { ...r },
          rowMeta: {},
        })),
      )

      countByStack.value.set(stackKey, response.pageInfo.totalRows ?? 0)
      hasMore.value.set(stackKey, !response.pageInfo.isLastPage)
      loadedStacksRef.value.add(stackKey)
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
      collapseStack,
      isCompactMode,
      loadKanbanMeta,
      loadKanbanData,
      loadKanbanDataForStack,
      updateKanbanStackMeta,
      toggleCompactMode,
    }
  },
  'use-kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) {
    throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')
  }

  return kanbanViewStore
}

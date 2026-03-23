import { message } from 'ant-design-vue'
import type { ColumnType, KanbanType, SelectOptionType, SortType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { Row as RowType } from '~/lib/types'
import {
  IsPublicInj,
  computed,
  inject,
  parseProp,
  reactive,
  ref,
  storeToRefs,
  useApi,
  useBase,
  useFieldQuery,
  useGlobal,
  useI18n,
  useInjectionState,
  useMetas,
  useNuxtApp,
  useRoles,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
  watch,
} from '#imports'

const [useProvideKanbanViewStore, useKanbanViewStore] = useInjectionState(
  (
    meta: Ref<TableType | KanbanType | undefined>,
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

    // use useFieldQuery for filter search
    const { search } = useFieldQuery()

    const groupingField = ref<string>('')

    const groupingFieldColOptions = ref<SelectOptionType[] & { collapsed: boolean }[]>([])

    const groupingFieldColumn = ref<ColumnType | undefined>()

    const stackMetaObj = ref<Record<string, Record<string, any>>>({})

    const formattedData = ref<Map<string, RowType[]>>(new Map<string, RowType[]>())

    const countByStack = ref<Map<string, number>>(new Map<string, number>())

    const groupingFieldTitleRef = ref<string>('')

    const loadedStacksRef = ref<Set<string>>(new Set())

    const activeStackId = ref<string>('')

    const loadMoreLoadingStack = ref<string | null>(null)

    // Compact mode - persisted per view
    const isCompactMode = ref<boolean>(false)

    const kanbanMetaData = ref<KanbanType>({})

    const groupingFieldValue = ref()

    const savedStack = ref<null | string>(null)

    const isRowsLoading = ref<boolean>(false)

    const isAddingEmptyRowAllowed = ref<boolean>(false)

    const hasMore = ref<Map<string, boolean>>(new Map<string, boolean>())

    const PAGE_SIZE = 25
    const collapseStack = ref<Map<string, boolean>>(new Map<string, boolean>())

    async function loadKanbanMeta() {
      if (!viewMeta?.value?.id || !meta?.value?.id) return

      const { metas } = useMetas()
      kanbanMetaData.value = await $api.dbView.kanbanRead(viewMeta.value.id)

      // get the grouping field column title
      const groupingFieldId = kanbanMetaData.value.fk_grp_col_id!
      const col = (meta.value as TableType)?.columns?.find((f) => f.id === groupingFieldId)
      groupingFieldColumn.value = col

      groupingField.value = col?.title || ''

      const gfMeta = await $api.dbTableColumn.read(groupingFieldId!)
      groupingFieldColOptions.value = gfMeta?.colOptions?.options || []
      stackMetaObj.value = parseProp(kanbanMetaData.value.meta)

      if (!stackMetaObj.value || !Object.keys(stackMetaObj.value).length) {
        await updateKanbanStackMeta()
      }
      
      // Load compact mode preference from meta
      isCompactMode.value = !!stackMetaObj.value?.isCompactMode
    }

    async function updateKanbanStackMeta() {
      const { metas } = useMetas()
      const { getMeta } = metas

      const kanbanMeta: Record<string, any> = {
        ...stackMetaObj.value,
        isCompactMode: isCompactMode.value,
      }

      if (!viewMeta.value?.id) return

      stackMetaObj.value = kanbanMeta

      await $api.dbView.kanbanUpdate(viewMeta.value.id, {
        meta: kanbanMeta,
      })
    }

    // Toggle compact mode and persist
    async function toggleCompactMode() {
      isCompactMode.value = !isCompactMode.value
      await updateKanbanStackMeta()
    }

    async function loadKanbanData() {
      if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return

      isRowsLoading.value = true

      try {
        await Promise.all(
          groupingFieldColOptions.value.map(async (option: SelectOptionType) => {
            const key = option.title!
            const hasMoreData = hasMore.value.get(key)

            if (hasMoreData === false) return

            const response = await api.dbViewRow.list('noco', base.value!.id!, meta.value!.id!, viewMeta.value!.id!, {
              limit: PAGE_SIZE,
              where: `(${groupingField.value},eq,${key})`,
              ...{},
            } as any)

            const data = response.list as RowType[]

            formattedData.value.set(
              key,
              data.map((r) => ({
                row: { ...r },
                oldRow: { ...r },
                rowMeta: {},
              })),
            )

            countByStack.value.set(key, response.pageInfo.totalRows ?? 0)
            hasMore.value.set(key, response.pageInfo.isLastPage === false)
            loadedStacksRef.value.add(key)
          }),
        )

        // Load uncategorized stack
        const uncategorizedResponse = await api.dbViewRow.list('noco', base.value!.id!, meta.value!.id!, viewMeta.value!.id!, {
          limit: PAGE_SIZE,
          where: `(${groupingField.value},is,null)`,
          ...{},
        } as any)

        formattedData.value.set(
          'uncategorized',
          uncategorizedResponse.list.map((r) => ({
            row: { ...r },
            oldRow: { ...r },
            rowMeta: {},
          })),
        )
        countByStack.value.set('uncategorized', uncategorizedResponse.pageInfo.totalRows ?? 0)
        hasMore.value.set('uncategorized', uncategorizedResponse.pageInfo.isLastPage === false)
        loadedStacksRef.value.add('uncategorized')
      } catch (e: any) {
        console.error(e)
        message.error(await extractSdkResponseErrorMsg(e))
      } finally {
        isRowsLoading.value = false
      }
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
      isCompactMode,
      kanbanMetaData,
      isRowsLoading,
      hasMore,
      collapseStack,
      loadKanbanMeta,
      loadKanbanData,
      updateKanbanStackMeta,
      toggleCompactMode,
    }
  },
  'kanban-view-store',
)

export { useProvideKanbanViewStore }

export function useKanbanViewStoreOrThrow() {
  const kanbanViewStore = useKanbanViewStore()

  if (kanbanViewStore == null) throw new Error('Please call `useProvideKanbanViewStore` on the appropriate parent component')

  return kanbanViewStore
}

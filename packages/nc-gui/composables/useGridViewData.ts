import axios from 'axios'
import type { Api, ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import { NavigateDir, type Row } from '#imports'

const formatData = (list: Record<string, any>[], pageInfo: PaginatedType) =>
  list.map((row, index) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {
      // Calculate the rowIndex based on the offset and the index of the row
      rowIndex: (pageInfo.page - 1) * pageInfo.pageSize + index,
    },
  }))

export function useGridViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
  reloadVisibleDataHook?: EventHook<void>,
) {
  const tablesStore = useTablesStore()
  const { activeTableId, activeTable } = storeToRefs(tablesStore)

  const meta = computed(() => _meta.value || activeTable.value)

  const metaId = computed(() => _meta.value?.id || activeTableId.value)

  const { t } = useI18n()

  const optimisedQuery = useState('optimisedQuery', () => true)

  const router = useRouter()

  const route = router.currentRoute

  const { appInfo, gridViewPageSize } = useGlobal()

  const appInfoDefaultLimit = gridViewPageSize.value || appInfo.value.defaultLimit || 25

  const _paginationData = ref<PaginatedType>({ page: 1, pageSize: appInfoDefaultLimit })

  const excludePageInfo = ref(false)

  const isPublic = inject(IsPublicInj, ref(false))

  const { base } = storeToRefs(useBase())

  const { fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()

  const { $api } = useNuxtApp()

  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

  const { isUIAllowed } = useRoles()

  const routeQuery = computed(() => route.value.query as Record<string, string>)

  const paginationData = computed({
    get: () => (isPublic.value ? sharedPaginationData.value : _paginationData.value),
    set: (value) => {
      if (isPublic.value) {
        sharedPaginationData.value = value
      } else {
        _paginationData.value = value
      }
    },
  })

  const {
    insertRow,
    updateRowProperty,
    addEmptyRow,
    deleteRow,
    deleteRowById,
    deleteSelectedRows,
    deleteRangeOfRows,
    updateOrSaveRow,
    cachedRows,
    clearCache,
    totalRows,
    bulkUpdateRows,
    bulkUpdateView,
    removeRowIfNew,
    syncCount,
    selectedRows,
    chunkStates,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      loadData,
      syncVisibleData,
    },
  })

  function syncVisibleData() {
    reloadVisibleDataHook?.trigger()
  }

  function getExpandedRowIndex(): number {
    const rowId = routeQuery.value.rowId
    if (!rowId) return -1

    for (const [_index, row] of cachedRows.value.entries()) {
      if (extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === rowId) {
        return row.rowMeta.rowIndex!
      }
    }
    return -1
  }

  const isLastRow = computed(() => {
    const expandedRowIndex = getExpandedRowIndex()
    if (expandedRowIndex === -1) return false

    return expandedRowIndex === totalRows.value - 1
  })

  const isFirstRow = computed(() => {
    const expandedRowIndex = getExpandedRowIndex()
    if (expandedRowIndex === -1) return false

    return expandedRowIndex === 0
  })

  const queryParams = computed(() => ({
    offset: ((paginationData.value.page ?? 0) - 1) * (paginationData.value.pageSize ?? appInfoDefaultLimit),
    limit: paginationData.value.pageSize ?? appInfoDefaultLimit,
    where: where?.value ?? '',
  }))

  async function loadAggCommentsCount(formattedData: Array<Row>) {
    if (!isUIAllowed('commentCount') || isPublic.value) return

    const ids = formattedData
      .filter(({ rowMeta: { new: isNew } }) => !isNew)
      .map(({ row }) => extractPkFromRow(row, meta?.value?.columns as ColumnType[]))
      .filter(Boolean)

    if (!ids.length) return

    try {
      const aggCommentCount = await $api.utils.commentCount({
        ids,
        fk_model_id: metaId.value as string,
      })

      formattedData.forEach((row) => {
        const cachedRow = Array.from(cachedRows.value.values()).find(
          (cachedRow) => cachedRow.rowMeta.rowIndex === row.rowMeta.rowIndex,
        )
        if (!cachedRow) return

        const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        const count = aggCommentCount?.find((c: Record<string, any>) => c.row_id === id)?.count || 0
        cachedRow.rowMeta.commentCount = +count
      })
    } catch (e) {
      console.error('Failed to load aggregate comment count:', e)
    }
  }

  async function loadData(
    params: Parameters<Api<any>['dbViewRow']['list']>[4] & {
      limit?: number
    } = {},
  ): Promise<Row[] | undefined> {
    if ((!base?.value?.id || !metaId.value || !viewMeta.value?.id) && !isPublic.value) return

    try {
      const response = !isPublic.value
        ? await $api.dbViewRow.list('noco', base.value.id!, metaId.value!, viewMeta.value!.id!, {
            ...queryParams.value,
            ...params,
            ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            where: where?.value,
            ...(excludePageInfo.value ? { excludeCount: 'true' } : {}),
          } as any)
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value, where: where?.value })

      const data = formatData(response.list, response.pageInfo)

      await loadAggCommentsCount(data)

      return data
    } catch (error: any) {
      if (error?.response?.data.error === 'INVALID_OFFSET_VALUE') {
        return []
      }
      if (error?.response?.data?.error === 'FORMULA_ERROR') {
        message.error(await extractSdkResponseErrorMsg(error))
        await tablesStore.reloadTableMeta(metaId.value as string)
        return loadData(params)
      }

      console.error(error)
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const navigateToSiblingRow = async (dir: NavigateDir) => {
    const expandedRowIndex = getExpandedRowIndex()
    if (expandedRowIndex === -1) return

    const sortedIndices = Array.from(cachedRows.value.keys()).sort((a, b) => a - b)
    let siblingIndex = sortedIndices.findIndex((index) => index === expandedRowIndex) + (dir === NavigateDir.NEXT ? 1 : -1)

    // Skip unsaved rows
    while (
      siblingIndex >= 0 &&
      siblingIndex < sortedIndices.length &&
      cachedRows.value.get(sortedIndices[siblingIndex])?.rowMeta?.new
    ) {
      siblingIndex += dir === NavigateDir.NEXT ? 1 : -1
    }

    // Check if we've gone out of bounds
    if (siblingIndex < 0 || siblingIndex >= totalRows.value) {
      return message.info(t('msg.info.noMoreRecords'))
    }

    // If the sibling row is not in cachedRows, load more data
    if (siblingIndex >= sortedIndices.length) {
      await loadData({
        offset: sortedIndices[sortedIndices.length - 1] + 1,
        limit: 10,
      })
      sortedIndices.push(
        ...Array.from(cachedRows.value.keys())
          .filter((key) => !sortedIndices.includes(key))
          .sort((a, b) => a - b),
      )
    }

    // Extract the row id of the sibling row
    const siblingRow = cachedRows.value.get(sortedIndices[siblingIndex])
    if (siblingRow) {
      const rowId = extractPkFromRow(siblingRow.row, meta.value?.columns as ColumnType[])
      if (rowId) {
        await router.push({
          query: {
            ...routeQuery.value,
            rowId,
          },
        })
      }
    }
  }

  return {
    cachedRows,
    loadData,
    paginationData,
    queryParams,
    insertRow,
    updateRowProperty,
    addEmptyRow,
    deleteRow,
    deleteRowById,
    deleteSelectedRows,
    deleteRangeOfRows,
    updateOrSaveRow,
    bulkUpdateRows,
    bulkUpdateView,
    loadAggCommentsCount,
    syncCount,
    removeRowIfNew,
    navigateToSiblingRow,
    getExpandedRowIndex,
    optimisedQuery,
    isLastRow,
    isFirstRow,
    clearCache,
    totalRows,
    selectedRows,
    syncVisibleData,
    chunkStates,
  }
}

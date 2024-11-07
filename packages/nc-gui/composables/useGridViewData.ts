import axios from 'axios'
import type { Api, ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { NavigateDir, type Row } from '#imports'

const formatData = (list: Record<string, any>[], pageInfo: PaginatedType) =>
  list.map((row, index) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {
      // Calculate the rowIndex based on the offset and the index of the row
      rowIndex: (pageInfo.offset ?? 0) + index,
    },
  }))

export function useGridViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
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
    cachedLocalRows,
    clearCache,
    virtualToRealIndex,
    realToVirtualIndex,
    totalRows,
    bulkUpdateRows,
    bulkUpdateView,
    removeRowIfNew,
    syncCount,
    selectedRows,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      changePage,
      loadData,
      syncPagination,
    },
  })

  function getExpandedRowIndex(): number {
    const rowId = routeQuery.value.rowId
    if (!rowId) return -1

    for (const [index, row] of Object.entries(cachedLocalRows.value)) {
      console.log(extractPkFromRow(row.row, meta.value?.columns as ColumnType[]))
      if (extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === rowId) {
        return parseInt(index)
      }
    }

    console.log('notFouns')
    return -1
  }

  const isLastRow = computed(() => {
    const expandedRowIndex = getExpandedRowIndex()
    if (expandedRowIndex === -1) return false
    const virtualIndex = realToVirtualIndex(expandedRowIndex)
    return virtualIndex === totalRows.value - 1
  })

  const isFirstRow = computed(() => {
    const expandedRowIndex = getExpandedRowIndex()
    if (expandedRowIndex === -1) return false
    const virtualIndex = realToVirtualIndex(expandedRowIndex)
    return virtualIndex === 0
  })

  const queryParams = computed(() => ({
    offset: ((paginationData.value.page ?? 0) - 1) * (paginationData.value.pageSize ?? appInfoDefaultLimit),
    limit: paginationData.value.pageSize ?? appInfoDefaultLimit,
    where: where?.value ?? '',
  }))

  async function syncPagination() {
    // total records in the current table
    const count = paginationData.value?.totalRows ?? Infinity
    // the number of rows in a page
    const size = paginationData.value.pageSize ?? appInfoDefaultLimit
    // the current page number
    const currentPage = paginationData.value.page ?? 1
    // the maximum possible page given the current count and the size
    const mxPage = Math.ceil(count / size)
    // calculate targetPage where 1 <= targetPage <= mxPage
    const targetPage = Math.max(1, Math.min(mxPage, currentPage))
    // if the current page is greater than targetPage,
    // then the page should be changed instead of showing an empty page
    // e.g. deleting all records in the last page N should return N - 1 page
    if (currentPage > targetPage) {
      // change to target page and load data of that page
      changePage?.(targetPage)
    } else {
      // the current page is same as target page
      // reload it to avoid empty row in this page
      await loadData({
        offset: (targetPage - 1) * size,
        where: where?.value,
      } as any)
    }
  }

  /** load row comments count */
  async function loadAggCommentsCount(formattedData: Array<Row>) {
    if (!isUIAllowed('commentCount')) return

    if (isPublic.value) return

    const ids = formattedData
      ?.filter(({ rowMeta: { new: isNew } }) => !isNew)
      ?.map(({ row }) => {
        return extractPkFromRow(row, meta?.value?.columns as ColumnType[])
      })

    if (!ids?.length || ids?.some((id) => !id)) return

    try {
      const aggCommentCount = await $api.utils.commentCount({
        ids,
        fk_model_id: metaId.value as string,
      })
      for (const row of formattedData) {
        const rowIndex = row.rowMeta.rowIndex!
        if (!cachedLocalRows.value[rowIndex]) continue
        const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        cachedLocalRows.value[rowIndex].rowMeta.commentCount = +(
          aggCommentCount?.find((c: Record<string, any>) => c.row_id === id)?.count || 0
        )
      }
    } catch (e) {
      console.error(e)
    }
  }

  const controller = ref()

  async function loadData(
    params: Parameters<Api<any>['dbViewRow']['list']>[4] & {
      limit?: number
    } = {},
  ) {
    if ((!base?.value?.id || !metaId.value || !viewMeta.value?.id) && !isPublic.value) return

    if (controller.value) {
      controller.value.cancel()
    }

    const CancelToken = axios.CancelToken

    controller.value = CancelToken.source()

    let response

    try {
      response = !isPublic.value
        ? await $api.dbViewRow.list(
            'noco',
            base.value.id!,
            metaId.value!,
            viewMeta.value!.id!,
            {
              ...queryParams.value,
              ...params,
              ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
              where: where?.value,
              ...(excludePageInfo.value ? { excludeCount: 'true' } : {}),
            } as any,
            {
              cancelToken: controller.value.token,
            },
          )
        : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value, where: where?.value })
    } catch (error: any) {
      // if the request is canceled, then do nothing
      if (error.code === 'ERR_CANCELED') {
        return
      }
      // retry the request if the error is FORMULA_ERROR
      if (error?.response?.data?.error === 'FORMULA_ERROR') {
        message.error(await extractSdkResponseErrorMsg(error))

        await tablesStore.reloadTableMeta(metaId.value as string)

        return loadData(params)
      }

      console.error(error)
      return message.error(await extractSdkResponseErrorMsg(error))
    }

    const data = formatData(response.list, response.pageInfo)

    loadAggCommentsCount(data)

    return data
  }

  async function changePage(page: number) {
    paginationData.value.page = page
    await loadData({
      offset: (page - 1) * (paginationData.value.pageSize || appInfoDefaultLimit),
      where: where?.value,
    } as any)
  }

  const navigateToSiblingRow = async (dir: NavigateDir) => {
    const expandedRowIndex = getExpandedRowIndex()
    console.log(expandedRowIndex)
    if (expandedRowIndex === -1) return

    // calculate next row index based on direction
    let siblingVirtualIndex = realToVirtualIndex(expandedRowIndex) + (dir === NavigateDir.NEXT ? 1 : -1)

    // if unsaved row skip it
    while (cachedLocalRows.value[virtualToRealIndex(siblingVirtualIndex)]?.rowMeta?.new) {
      siblingVirtualIndex = siblingVirtualIndex + (dir === NavigateDir.NEXT ? 1 : -1)
    }

    // if next row index is less than 0, there's no previous row
    if (siblingVirtualIndex < 0) {
      return message.info(t('msg.info.noMoreRecords'))
    }

    if (!cachedLocalRows.value[virtualToRealIndex(siblingVirtualIndex)]) {
      await loadData({
        offset: siblingVirtualIndex,
        limit: 10,
      })
    }

    // extract the row id of the sibling row
    const rowId = extractPkFromRow(
      cachedLocalRows.value[virtualToRealIndex(siblingVirtualIndex)].row,
      meta.value?.columns as ColumnType[],
    )
    if (rowId) {
      await router.push({
        query: {
          ...routeQuery.value,
          rowId,
        },
      })
    }
  }

  return {
    cachedLocalRows,
    loadData,
    paginationData,
    queryParams,
    insertRow,
    updateRowProperty,
    changePage,
    addEmptyRow,
    deleteRow,
    deleteRowById,
    deleteSelectedRows,
    deleteRangeOfRows,
    updateOrSaveRow,
    bulkUpdateRows,
    bulkUpdateView,
    syncPagination,
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
  }
}

import { ViewTypes } from 'nocodb-sdk'
import axios from 'axios'
import type { Api, ColumnType, FormColumnType, FormType, GalleryType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { NavigateDir } from '#imports'

const formatData = (list: Record<string, any>[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

export function useViewData(
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

  const { api, isLoading, error } = useApi()

  const router = useRouter()

  const route = router.currentRoute

  const { appInfo, gridViewPageSize } = useGlobal()

  const appInfoDefaultLimit = gridViewPageSize.value || appInfo.value.defaultLimit || 25

  const _paginationData = ref<PaginatedType>({ page: 1, pageSize: appInfoDefaultLimit })

  const aggCommentCount = ref<{ row_id: string; count: string }[]>([])

  const galleryData = ref<GalleryType>()

  const formColumnData = ref<Record<string, any>[]>()

  const formViewData = ref<FormType>()

  const formattedData = ref<Row[]>([])

  const excludePageInfo = ref(false)

  const isPublic = inject(IsPublicInj, ref(false))

  const { base } = storeToRefs(useBase())

  const { sharedView, fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()

  const { $api } = useNuxtApp()

  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

  const { isUIAllowed } = useRoles()

  const routeQuery = computed(() => route.value.query as Record<string, string>)

  const { isPaginationLoading } = storeToRefs(useViewsStore())

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

  const islastRow = computed(() => {
    const currentIndex = getExpandedRowIndex()
    return paginationData.value?.isLastPage && currentIndex === formattedData.value.length - 1
  })

  const isFirstRow = computed(() => {
    const currentIndex = getExpandedRowIndex()
    return paginationData.value?.isFirstPage && currentIndex === 0
  })

  const queryParams = computed(() => ({
    offset: ((paginationData.value.page ?? 0) - 1) * (paginationData.value.pageSize ?? appInfoDefaultLimit),
    limit: paginationData.value.pageSize ?? appInfoDefaultLimit,
    where: where?.value ?? '',
  }))

  async function syncCount() {
    const { count } = await $api.dbViewRow.count(
      NOCO,
      base?.value?.id as string,
      metaId.value as string,
      viewMeta?.value?.id as string,
    )
    paginationData.value.totalRows = count
  }

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
  async function loadAggCommentsCount() {
    if (!isUIAllowed('commentCount')) return

    if (isPublic.value) return

    const ids = formattedData.value
      ?.filter(({ rowMeta: { new: isNew } }) => !isNew)
      ?.map(({ row }) => {
        return extractPkFromRow(row, meta?.value?.columns as ColumnType[])
      })

    if (!ids?.length || ids?.some((id) => !id)) return

    try {
      aggCommentCount.value = await $api.utils.commentCount({
        ids,
        fk_model_id: metaId.value as string,
      })

      for (const row of formattedData.value) {
        const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        row.rowMeta.commentCount = +(aggCommentCount.value?.find((c: Record<string, any>) => c.row_id === id)?.count || 0)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const controller = ref()

  async function loadData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}, shouldShowLoading = true) {
    if ((!base?.value?.id || !metaId.value || !viewMeta.value?.id) && !isPublic.value) return

    if (controller.value) {
      controller.value.cancel()
    }

    const CancelToken = axios.CancelToken

    controller.value = CancelToken.source()

    if (shouldShowLoading) isPaginationLoading.value = true
    let response

    try {
      response = !isPublic.value
        ? await api.dbViewRow.list(
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
    } catch (error) {
      // if the request is canceled, then do nothing
      if (error.code === 'ERR_CANCELED') {
        return
      }

      // retry the request if the error is FORMULA_ERROR
      if (error?.response?.data?.error === 'FORMULA_ERROR') {
        message.error(await extractSdkResponseErrorMsg(error))

        await tablesStore.reloadTableMeta(metaId.value as string)

        return loadData(params, shouldShowLoading)
      }

      console.error(error)
      return message.error(await extractSdkResponseErrorMsg(error))
    }
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo || paginationData.value || {}

    // if public then update sharedPaginationData
    if (isPublic.value) {
      sharedPaginationData.value = paginationData.value
    }

    excludePageInfo.value = !response.pageInfo
    isPaginationLoading.value = false

    // to cater the case like when querying with a non-zero offset
    // the result page may point to the target page where the actual returned data don't display on
    if (paginationData.value.totalRows !== undefined && paginationData.value.totalRows !== null) {
      const expectedPage = Math.max(1, Math.ceil(paginationData.value.totalRows! / paginationData.value.pageSize!))
      if (expectedPage < paginationData.value.page!) {
        await changePage(expectedPage)
      }
    }
    if (viewMeta.value?.type === ViewTypes.GRID) {
      loadAggCommentsCount()
    }
  }

  async function loadGalleryData() {
    if (!viewMeta?.value?.id) return
    galleryData.value = isPublic.value
      ? (sharedView.value?.view as GalleryType)
      : await $api.dbView.galleryRead(viewMeta.value.id)
  }

  async function changePage(page: number) {
    paginationData.value.page = page
    await loadData(
      {
        offset: (page - 1) * (paginationData.value.pageSize || appInfoDefaultLimit),
        where: where?.value,
      } as any,
      true,
    )
  }

  const {
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
    selectedAllRecords,
    removeRowIfNew,
  } = useData({
    meta,
    viewMeta,
    formattedData,
    paginationData,
    callbacks: {
      changePage,
      loadData,
      syncCount,
      syncPagination,
    },
  })

  async function loadFormView() {
    if (!viewMeta?.value?.id) return
    try {
      const { columns, ...view } = await $api.dbView.formRead(viewMeta.value.id)
      let order = 1
      const fieldById = (columns || []).reduce((o: Record<string, any>, f: Record<string, any>) => {
        if (order < f.order) {
          order = f.order
        }
        return {
          ...o,
          [f.fk_column_id]: f,
        }
      }, {} as Record<string, FormColumnType>)

      formViewData.value = view

      formColumnData.value = meta?.value?.columns
        ?.map((c: ColumnType) => ({
          ...c,
          fk_column_id: c.id,
          fk_view_id: viewMeta.value?.id,
          ...(fieldById[c.id!] ? fieldById[c.id!] : {}),
          meta: {
            validators: [],
            visibility: {
              errors: {},
            },
            ...parseProp(fieldById[c.id!]?.meta),
            ...parseProp(c.meta),
          },
          order: (fieldById[c.id!] && fieldById[c.id!].order) || order++,
          id: fieldById[c.id!] && fieldById[c.id!].id,
          visible: true,
        }))
        .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order) as Record<string, any>[]
    } catch (e: any) {
      return message.error(`${t('msg.error.setFormDataFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function updateFormView(view: FormType | undefined) {
    try {
      if (!viewMeta?.value?.id || !view) return
      await $api.dbView.formUpdate(viewMeta.value.id, view)
    } catch (e: any) {
      return message.error(`${t('msg.error.formViewUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  // get current expanded row index
  function getExpandedRowIndex() {
    return formattedData.value.findIndex(
      (row: Row) => routeQuery.value.rowId === extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
    )
  }

  const navigateToSiblingRow = async (dir: NavigateDir) => {
    const expandedRowIndex = getExpandedRowIndex()

    // calculate next row index based on direction
    let siblingRowIndex = expandedRowIndex + (dir === NavigateDir.NEXT ? 1 : -1)

    // if unsaved row skip it
    while (formattedData.value[siblingRowIndex]?.rowMeta?.new) {
      siblingRowIndex = siblingRowIndex + (dir === NavigateDir.NEXT ? 1 : -1)
    }

    const currentPage = paginationData?.value?.page || 1

    // if next row index is less than 0, go to previous page and point to last element
    if (siblingRowIndex < 0) {
      // if first page, do nothing
      if (currentPage === 1) return message.info(t('msg.info.noMoreRecords'))

      await changePage(currentPage - 1)
      siblingRowIndex = formattedData.value.length - 1

      // if next row index is greater than total rows in current view
      // then load next page of formattedData and set next row index to 0
    } else if (siblingRowIndex >= formattedData.value.length) {
      if (paginationData?.value?.isLastPage) return message.info(t('msg.info.noMoreRecords'))

      await changePage(currentPage + 1)
      siblingRowIndex = 0
    }

    // extract the row id of the sibling row
    const rowId = extractPkFromRow(formattedData.value[siblingRowIndex].row, meta.value?.columns as ColumnType[])
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
    error,
    isLoading,
    loadData,
    paginationData,
    queryParams,
    formattedData,
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
    selectedAllRecords,
    syncCount,
    syncPagination,
    galleryData,
    loadGalleryData,
    loadFormView,
    formColumnData,
    formViewData,
    updateFormView,
    aggCommentCount,
    loadAggCommentsCount,
    removeRowIfNew,
    navigateToSiblingRow,
    getExpandedRowIndex,
    optimisedQuery,
    islastRow,
    isFirstRow,
  }
}

import { ViewTypes } from 'nocodb-sdk'
import type { Api, ColumnType, FormType, GalleryType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import {
  IsPublicInj,
  NOCO,
  computed,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  getHTMLEncodedText,
  message,
  ref,
  useApi,
  useGlobal,
  useI18n,
  useNuxtApp,
  useProject,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import type { Row } from '~/lib'

const formatData = (list: Record<string, any>[]) =>
  list.map((row) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {},
  }))

export function useViewData(
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
) {
  if (!meta) {
    throw new Error('Table meta is not available')
  }

  const { t } = useI18n()

  const { api, isLoading, error } = useApi()

const { appInfo } = $(useGlobal())
  const appInfoDefaultLimit = appInfo.defaultLimit || 25
  const _paginationData = ref<PaginatedType>({ page: 1, pageSize: appInfoDefaultLimit })
  const aggCommentCount = ref<{ row_id: string; count: number }[]>([])

  const galleryData = ref<GalleryType>()

  const formColumnData = ref<FormType>()

  const formViewData = ref<FormType>()

  const formattedData = ref<Row[]>([])

  const isPublic = inject(IsPublicInj, ref(false))

  const { project, isSharedBase } = useProject()

  const { fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()

  const { $api, $e } = useNuxtApp()

  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

  const { isUIAllowed } = useUIPermission()

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

  const selectedAllRecords = computed({
    get() {
      return !!formattedData.value.length && formattedData.value.every((row: Row) => row.rowMeta.selected)
    },
    set(selected: boolean) {
      formattedData.value.forEach((row: Row) => (row.rowMeta.selected = selected))
    },
  })

  const queryParams = computed(() => ({
    offset: ((paginationData.value.page ?? 0) - 1) * (paginationData.value.pageSize ?? appInfoDefaultLimit),
    limit: paginationData.value.pageSize ?? appInfoDefaultLimit,
    where: where?.value ?? '',
  }))

  function addEmptyRow(addAfter = formattedData.value.length) {
    formattedData.value.splice(addAfter, 0, {
      row: {},
      oldRow: {},
      rowMeta: { new: true },
    })

    return formattedData.value[addAfter]
  }

  function removeLastEmptyRow() {
    const lastRow = formattedData.value[formattedData.value.length - 1]

    if (lastRow.rowMeta.new) {
      formattedData.value.pop()
    }
  }

  async function syncCount() {
    const { count } = await $api.dbViewRow.count(
      NOCO,
      project?.value?.title as string,
      meta?.value?.id as string,
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
    if (isPublic.value || isSharedBase.value) return

    const ids = formattedData.value
      ?.filter(({ rowMeta: { new: isNew } }) => !isNew)
      ?.map(({ row }) => {
        return extractPkFromRow(row, meta?.value?.columns as ColumnType[])
      })

    if (!ids?.length || ids?.some((id) => !id)) return

    aggCommentCount.value = await $api.utils.commentCount({
      ids,
      fk_model_id: meta.value?.id as string,
    })

    for (const row of formattedData.value) {
      const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
      row.rowMeta.commentCount = aggCommentCount.value?.find((c: Record<string, any>) => c.row_id === id)?.count || 0
    }
  }

  async function loadData(params: Parameters<Api<any>['dbViewRow']['list']>[4] = {}) {
    if ((!project?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic.value) return
    const response = !isPublic.value
      ? await api.dbViewRow.list('noco', project.value.id!, meta.value!.id!, viewMeta.value!.id!, {
          ...queryParams.value,
          ...params,
          ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          where: where?.value,
        })
      : await fetchSharedViewData()
    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo
    if (viewMeta.value?.type === ViewTypes.GRID) {
      await loadAggCommentsCount()
    }
  }

  async function loadGalleryData() {
    if (!viewMeta?.value?.id) return

    galleryData.value = await $api.dbView.galleryRead(viewMeta.value.id)
  }

  async function insertRow(row: Record<string, any>, rowIndex = formattedData.value?.length) {
    try {
      const insertObj = meta?.value?.columns?.reduce((o: any, col) => {
        if (!col.ai && row?.[col.title as string] !== null) {
          o[col.title as string] = row?.[col.title as string]
        }
        return o
      }, {})

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        project?.value.id as string,
        meta.value?.id as string,
        viewMeta?.value?.id as string,
        insertObj,
      )

      formattedData.value?.splice(rowIndex ?? 0, 1, {
        row: insertedData,
        rowMeta: {},
        oldRow: { ...insertedData },
      })

      await syncCount()
      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  async function updateRowProperty(toUpdate: Row, property: string) {
    try {
      const id = extractPkFromRow(toUpdate.row, meta.value?.columns as ColumnType[])

      const updatedRowData = await $api.dbViewRow.update(
        NOCO,
        project?.value.id as string,
        meta.value?.id as string,
        viewMeta?.value?.id as string,
        id,
        {
          [property]: toUpdate.row[property],
        },
        // todo:
        // {
        //   query: { ignoreWebhook: !saved }
        // }
      )
      // audit
      $api.utils
        .auditRowUpdate(id, {
          fk_model_id: meta.value?.id as string,
          column_name: property,
          row_id: id,
          value: getHTMLEncodedText(toUpdate.row[property]),
          prev_value: getHTMLEncodedText(toUpdate.oldRow[property]),
        })
        .then(() => {})

      /** update row data(to sync formula and other related columns) */
      Object.assign(toUpdate.row, updatedRowData)
      Object.assign(toUpdate.oldRow, updatedRowData)
    } catch (e: any) {
      message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function updateOrSaveRow(row: Row, property?: string) {
    if (row.rowMeta.new) {
      return await insertRow(row.row, formattedData.value.indexOf(row))
    } else {
      await updateRowProperty(row, property!)
    }
  }

  async function changePage(page: number) {
    paginationData.value.page = page
    await loadData({ offset: (page - 1) * (paginationData.value.pageSize || appInfoDefaultLimit), where: where?.value } as any)
    $e('a:grid:pagination')
  }

  async function deleteRowById(id: string) {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    const res: any = await $api.dbViewRow.delete(
      'noco',
      project.value.id as string,
      meta.value?.id as string,
      viewMeta.value?.id as string,
      id,
    )

    if (res.message) {
      message.info(
        `Row delete failed: ${`Unable to delete row with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
      )
      return false
    }
    return true
  }

  async function deleteRow(rowIndex: number) {
    try {
      const row = formattedData.value[rowIndex]
      if (!row.rowMeta.new) {
        const id = meta?.value?.columns
          ?.filter((c) => c.pk)
          .map((c) => row.row[c.title!])
          .join('___')

        const deleted = await deleteRowById(id as string)
        if (!deleted) {
          return
        }
      }

      formattedData.value.splice(rowIndex, 1)

      await syncCount()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function deleteSelectedRows() {
    let row = formattedData.value.length
    while (row--) {
      try {
        const { row: rowObj, rowMeta } = formattedData.value[row] as Record<string, any>
        if (!rowMeta.selected) {
          continue
        }
        if (!rowMeta.new) {
          const id = meta?.value?.columns
            ?.filter((c) => c.pk)
            .map((c) => rowObj[c.title as string])
            .join('___')

          const successfulDeletion = await deleteRowById(id as string)
          if (!successfulDeletion) {
            continue
          }
        }
        formattedData.value.splice(row, 1)
      } catch (e: any) {
        return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    await syncCount()
    await syncPagination()
  }

  async function loadFormView() {
    if (!viewMeta?.value?.id) return
    try {
      const { columns, ...view } = (await $api.dbView.formRead(viewMeta.value.id)) as Record<string, any>

      const fieldById = columns.reduce(
        (o: Record<string, any>, f: Record<string, any>) => ({
          ...o,
          [f.fk_column_id]: f,
        }),
        {},
      )

      let order = 1

      formViewData.value = view

      formColumnData.value = meta?.value?.columns
        ?.map((c: Record<string, any>) => ({
          ...c,
          fk_column_id: c.id,
          fk_view_id: viewMeta.value?.id,
          ...(fieldById[c.id] ? fieldById[c.id] : {}),
          order: (fieldById[c.id] && fieldById[c.id].order) || order++,
          id: fieldById[c.id] && fieldById[c.id].id,
        }))
        .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order) as Record<string, any>
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

  const removeRowIfNew = (row: Row) => {
    const index = formattedData.value.indexOf(row)

    if (index > -1 && row.rowMeta.new) {
      formattedData.value.splice(index, 1)
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
    deleteSelectedRows,
    updateOrSaveRow,
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
    removeLastEmptyRow,
    removeRowIfNew,
  }
}

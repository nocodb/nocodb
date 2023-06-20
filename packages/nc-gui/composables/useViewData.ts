import { UITypes, ViewTypes } from 'nocodb-sdk'
import type { Api, ColumnType, FormColumnType, FormType, GalleryType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { CellRange } from '#imports'
import {
  IsPublicInj,
  NOCO,
  NavigateDir,
  computed,
  extractPkFromRow,
  extractSdkResponseErrorMsg,
  message,
  populateInsertObject,
  ref,
  rowPkData,
  storeToRefs,
  until,
  useApi,
  useGlobal,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  useRouter,
  useSharedView,
  useSmartsheetStoreOrThrow,
  useUIPermission,
} from '#imports'
import type { Row, UndoRedoAction } from '~/lib'

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

  const router = useRouter()

  const route = $(router.currentRoute)

  const { appInfo } = $(useGlobal())

  const { getMeta } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const appInfoDefaultLimit = appInfo.defaultLimit || 25

  const _paginationData = ref<PaginatedType>({ page: 1, pageSize: appInfoDefaultLimit })

  const aggCommentCount = ref<{ row_id: string; count: string }[]>([])

  const galleryData = ref<GalleryType>()

  const formColumnData = ref<Record<string, any>[]>()

  const formViewData = ref<FormType>()

  const formattedData = ref<Row[]>([])

  const isPublic = inject(IsPublicInj, ref(false))

  const { project, isSharedBase } = storeToRefs(useProject())

  const { sharedView, fetchSharedViewData, paginationData: sharedPaginationData } = useSharedView()

  const { $api, $e } = useNuxtApp()

  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

  const { isUIAllowed } = useUIPermission()

  const routeQuery = $computed(() => route.query as Record<string, string>)

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
      project?.value?.id as string,
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
      row.rowMeta.commentCount = +(aggCommentCount.value?.find((c: Record<string, any>) => c.row_id === id)?.count || 0)
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
      : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value })

    formattedData.value = formatData(response.list)
    paginationData.value = response.pageInfo

    // to cater the case like when querying with a non-zero offset
    // the result page may point to the target page where the actual returned data don't display on
    const expectedPage = Math.max(1, Math.ceil(paginationData.value.totalRows! / paginationData.value.pageSize!))
    if (expectedPage < paginationData.value.page!) {
      await changePage(expectedPage)
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

  const findIndexByPk = (pk: Record<string, string>) => {
    for (const [i, row] of Object.entries(formattedData.value)) {
      if (Object.keys(pk).every((k) => pk[k] === row.row[k])) {
        return parseInt(i)
      }
    }
    return -1
  }

  async function insertRow(
    currentRow: Row,
    ltarState: Record<string, any> = {},
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    const row = currentRow.row
    if (currentRow.rowMeta) currentRow.rowMeta.saving = true
    try {
      const { missingRequiredColumns, insertObj } = await populateInsertObject({
        meta: metaValue!,
        ltarState,
        getMeta,
        row,
        undo,
      })

      if (missingRequiredColumns.size) return

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        project?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        insertObj,
      )

      if (!undo) {
        Object.assign(currentRow, {
          row: { ...insertedData, ...row },
          rowMeta: { ...(currentRow.rowMeta || {}), new: undefined },
          oldRow: { ...insertedData },
        })

        const id = extractPkFromRow(insertedData, metaValue?.columns as ColumnType[])
        const pkData = rowPkData(insertedData, metaValue?.columns as ColumnType[])
        const rowIndex = findIndexByPk(pkData)

        addUndo({
          redo: {
            fn: async function redo(
              this: UndoRedoAction,
              row: Row,
              ltarState: Record<string, any>,
              pg: { page: number; pageSize: number },
            ) {
              row.row = { ...pkData, ...row.row }
              const insertedData = await insertRow(row, ltarState, undefined, true)
              if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
                if (pg.page === paginationData.value.page) {
                  formattedData.value.splice(rowIndex, 0, {
                    row: { ...row, ...insertedData },
                    rowMeta: row.rowMeta,
                    oldRow: row.oldRow,
                  })
                } else {
                  await changePage(pg.page)
                }
              } else {
                await loadData()
              }
            },
            args: [
              clone(currentRow),
              clone(ltarState),
              { page: paginationData.value.page, pageSize: paginationData.value.pageSize },
            ],
          },
          undo: {
            fn: async function undo(this: UndoRedoAction, id: string) {
              await deleteRowById(id)
              if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
              paginationData.value.totalRows = paginationData.value.totalRows! - 1
            },
            args: [id],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      await syncCount()
      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      if (currentRow.rowMeta) currentRow.rowMeta.saving = false
    }
  }

  // inside this method use metaValue and viewMetaValue to refer meta
  // since sometimes we need to pass old metas
  async function updateRowProperty(
    toUpdate: Row,
    property: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    if (toUpdate.rowMeta) toUpdate.rowMeta.saving = true

    try {
      const id = extractPkFromRow(toUpdate.row, metaValue?.columns as ColumnType[])

      const updatedRowData = await $api.dbViewRow.update(
        NOCO,
        project?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        encodeURIComponent(id),
        {
          // if value is undefined treat it as null
          [property]: toUpdate.row[property] ?? null,
        },
        // todo:
        // {
        //   query: { ignoreWebhook: !saved }
        // }
      )

      if (!undo) {
        addUndo({
          redo: {
            fn: async function redo(toUpdate: Row, property: string, pg: { page: number; pageSize: number }) {
              const updatedData = await updateRowProperty(toUpdate, property, undefined, true)
              if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]))
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, updatedData)
                  Object.assign(row.oldRow, updatedData)
                } else {
                  await loadData()
                }
              } else {
                await changePage(pg.page)
              }
            },
            args: [clone(toUpdate), property, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
          },
          undo: {
            fn: async function undo(toUpdate: Row, property: string, pg: { page: number; pageSize: number }) {
              const updatedData = await updateRowProperty(
                { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                property,
                undefined,
                true,
              )
              if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]))
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, updatedData)
                  Object.assign(row.oldRow, updatedData)
                } else {
                  await loadData()
                }
              } else {
                await changePage(pg.page)
              }
            },
            args: [clone(toUpdate), property, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })

        /** update row data(to sync formula and other related columns)
         * update only formula, rollup and auto updated datetime columns data to avoid overwriting any changes made by user
         */
        Object.assign(
          toUpdate.row,
          metaValue!.columns!.reduce<Record<string, any>>((acc: Record<string, any>, col: ColumnType) => {
            if (
              col.uidt === UITypes.Formula ||
              col.uidt === UITypes.QrCode ||
              col.uidt === UITypes.Barcode ||
              col.uidt === UITypes.Rollup ||
              col.au ||
              col.cdf?.includes(' on update ')
            )
              acc[col.title!] = updatedRowData[col.title!]
            return acc
          }, {} as Record<string, any>),
        )
        Object.assign(toUpdate.oldRow, updatedRowData)
      }

      return updatedRowData
    } catch (e: any) {
      message.error(`${t('msg.error.rowUpdateFailed')} ${await extractSdkResponseErrorMsg(e)}`)
    } finally {
      if (toUpdate.rowMeta) toUpdate.rowMeta.saving = false
    }
  }

  async function updateOrSaveRow(
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    // update changed status
    if (row.rowMeta) row.rowMeta.changed = false

    // if new row and save is in progress then wait until the save is complete
    await until(() => !(row.rowMeta?.new && row.rowMeta?.saving)).toMatch((v) => v)

    if (row.rowMeta.new) {
      return await insertRow(row, ltarState, args)
    } else {
      // if the field name is missing skip update
      if (property) {
        await updateRowProperty(row, property, args)
      }
    }
  }

  async function bulkUpdateRows(
    rows: Row[],
    props: string[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    const promises = []

    for (const row of rows) {
      // update changed status
      if (row.rowMeta) row.rowMeta.changed = false

      // if new row and save is in progress then wait until the save is complete
      promises.push(until(() => !(row.rowMeta?.new && row.rowMeta?.saving)).toMatch((v) => v))
    }

    await Promise.all(promises)

    const updateArray = []

    for (const row of rows) {
      if (row.rowMeta) row.rowMeta.saving = true

      const pk = rowPkData(row.row, metaValue?.columns as ColumnType[])

      const updateData = props.reduce((acc: Record<string, any>, prop) => {
        acc[prop] = row.row[prop]
        return acc
      }, {} as Record<string, any>)

      updateArray.push({ ...updateData, ...pk })
    }

    if (!undo) {
      addUndo({
        redo: {
          fn: async function redo(redoRows: Row[], props: string[], pg: { page: number; pageSize: number }) {
            await bulkUpdateRows(redoRows, props, { metaValue, viewMetaValue }, true)
            if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
              for (const toUpdate of redoRows) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]))
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, toUpdate.row)
                  Object.assign(row.oldRow, toUpdate.row)
                } else {
                  await loadData()
                  break
                }
              }
            } else {
              await changePage(pg.page)
            }
          },
          args: [clone(rows), clone(props), { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
        },
        undo: {
          fn: async function undo(undoRows: Row[], props: string[], pg: { page: number; pageSize: number }) {
            await bulkUpdateRows(undoRows, props, { metaValue, viewMetaValue }, true)
            if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
              for (const toUpdate of undoRows) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]))
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, toUpdate.row)
                  Object.assign(row.oldRow, toUpdate.row)
                } else {
                  await loadData()
                  break
                }
              }
            } else {
              await changePage(pg.page)
            }
          },
          args: [
            clone(
              rows.map((row) => {
                return { row: row.oldRow, oldRow: row.row, rowMeta: row.rowMeta }
              }),
            ),
            props,
            { page: paginationData.value.page, pageSize: paginationData.value.pageSize },
          ],
        },
        scope: defineViewScope({ view: viewMetaValue }),
      })
    }

    await $api.dbTableRow.bulkUpdate(NOCO, metaValue?.project_id as string, metaValue?.id as string, updateArray)

    for (const row of rows) {
      if (!undo) {
        /** update row data(to sync formula and other related columns)
         * update only formula, rollup and auto updated datetime columns data to avoid overwriting any changes made by user
         */
        Object.assign(
          row.row,
          metaValue!.columns!.reduce<Record<string, any>>((acc: Record<string, any>, col: ColumnType) => {
            if (
              col.uidt === UITypes.Formula ||
              col.uidt === UITypes.QrCode ||
              col.uidt === UITypes.Barcode ||
              col.uidt === UITypes.Rollup ||
              col.au ||
              col.cdf?.includes(' on update ')
            )
              acc[col.title!] = row.row[col.title!]
            return acc
          }, {} as Record<string, any>),
        )
        Object.assign(row.oldRow, row.row)
      }

      if (row.rowMeta) row.rowMeta.saving = false
    }
  }

  async function changePage(page: number) {
    paginationData.value.page = page
    await loadData({
      offset: (page - 1) * (paginationData.value.pageSize || appInfoDefaultLimit),
      where: where?.value,
    } as any)
    $e('a:grid:pagination')
  }

  async function deleteRowById(
    id: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    const res: any = await $api.dbViewRow.delete(
      'noco',
      project.value.id as string,
      metaValue?.id as string,
      viewMetaValue?.id as string,
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

  async function deleteRow(rowIndex: number, undo?: boolean) {
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

        if (!undo) {
          addUndo({
            redo: {
              fn: async function redo(this: UndoRedoAction, id: string) {
                await deleteRowById(id)
                const pk: Record<string, string> = rowPkData(row.row, meta?.value?.columns as ColumnType[])
                const rowIndex = findIndexByPk(pk)
                if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
                paginationData.value.totalRows = paginationData.value.totalRows! - 1
              },
              args: [id],
            },
            undo: {
              fn: async function undo(
                this: UndoRedoAction,
                row: Row,
                ltarState: Record<string, any>,
                pg: { page: number; pageSize: number },
              ) {
                const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
                row.row = { ...pkData, ...row.row }
                await insertRow(row, ltarState, {}, true)
                if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
                  if (pg.page === paginationData.value.page) {
                    formattedData.value.splice(rowIndex, 0, row)
                  } else {
                    await changePage(pg.page)
                  }
                } else {
                  await loadData()
                }
              },
              args: [clone(row), {}, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
            },
            scope: defineViewScope({ view: viewMeta.value }),
          })
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
    const removedRowsData: { id?: string; row: Row; rowIndex: number }[] = []
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
          removedRowsData.push({ id, row: clone(formattedData.value[row]), rowIndex: row })
        }
        formattedData.value.splice(row, 1)
      } catch (e: any) {
        return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    addUndo({
      redo: {
        fn: async function redo(this: UndoRedoAction, removedRowsData: { id?: string; row: Row; rowIndex: number }[]) {
          for (const { id, row } of removedRowsData) {
            await deleteRowById(id as string)
            const pk: Record<string, string> = rowPkData(row.row, meta?.value?.columns as ColumnType[])
            const rowIndex = findIndexByPk(pk)
            if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
            paginationData.value.totalRows = paginationData.value.totalRows! - 1
          }
          await syncPagination()
        },
        args: [removedRowsData],
      },
      undo: {
        fn: async function undo(
          this: UndoRedoAction,
          removedRowsData: { id?: string; row: Row; rowIndex: number }[],
          pg: { page: number; pageSize: number },
        ) {
          for (const { row, rowIndex } of removedRowsData.slice().reverse()) {
            const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
            row.row = { ...pkData, ...row.row }
            await insertRow(row, {}, {}, true)
            if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
              if (pg.page === paginationData.value.page) {
                formattedData.value.splice(rowIndex, 0, row)
              } else {
                await changePage(pg.page)
              }
            } else {
              await loadData()
            }
          }
        },
        args: [removedRowsData, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    await syncCount()
    await syncPagination()
  }

  async function deleteRangeOfRows(cellRange: CellRange) {
    if (!cellRange._start || !cellRange._end) return
    const start = Math.max(cellRange._start.row, cellRange._end.row)
    const end = Math.min(cellRange._start.row, cellRange._end.row)

    // plus one because we want to include the end row
    let row = start + 1

    const removedRowsData: { id?: string; row: Row; rowIndex: number }[] = []
    while (row--) {
      try {
        const { row: rowObj, rowMeta } = formattedData.value[row] as Record<string, any>
        if (!rowMeta.new) {
          const id = meta?.value?.columns
            ?.filter((c) => c.pk)
            .map((c) => rowObj[c.title as string])
            .join('___')

          const successfulDeletion = await deleteRowById(id as string)
          if (!successfulDeletion) {
            continue
          }
          removedRowsData.push({ id, row: clone(formattedData.value[row]), rowIndex: row })
        }
        formattedData.value.splice(row, 1)
      } catch (e: any) {
        return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }

      if (row === end) break
    }

    addUndo({
      redo: {
        fn: async function redo(this: UndoRedoAction, removedRowsData: { id?: string; row: Row; rowIndex: number }[]) {
          for (const { id, row } of removedRowsData) {
            await deleteRowById(id as string)
            const pk: Record<string, string> = rowPkData(row.row, meta?.value?.columns as ColumnType[])
            const rowIndex = findIndexByPk(pk)
            if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
            paginationData.value.totalRows = paginationData.value.totalRows! - 1
          }
          await syncPagination()
        },
        args: [removedRowsData],
      },
      undo: {
        fn: async function undo(
          this: UndoRedoAction,
          removedRowsData: { id?: string; row: Row; rowIndex: number }[],
          pg: { page: number; pageSize: number },
        ) {
          for (const { row, rowIndex } of removedRowsData.slice().reverse()) {
            const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
            row.row = { ...pkData, ...row.row }
            await insertRow(row, {}, {}, true)
            if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
              if (pg.page === paginationData.value.page) {
                formattedData.value.splice(rowIndex, 0, row)
              } else {
                await changePage(pg.page)
              }
            } else {
              await loadData()
            }
          }
        },
        args: [removedRowsData, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    await syncCount()
    await syncPagination()
  }

  async function loadFormView() {
    if (!viewMeta?.value?.id) return
    try {
      const { columns, ...view } = await $api.dbView.formRead(viewMeta.value.id)

      const fieldById = (columns || []).reduce(
        (o: Record<string, any>, f: Record<string, any>) => ({
          ...o,
          [f.fk_column_id]: f,
        }),
        {} as Record<string, FormColumnType>,
      )

      let order = 1

      formViewData.value = view

      formColumnData.value = meta?.value?.columns
        ?.map((c: ColumnType) => ({
          ...c,
          fk_column_id: c.id,
          fk_view_id: viewMeta.value?.id,
          ...(fieldById[c.id!] ? fieldById[c.id!] : {}),
          order: (fieldById[c.id!] && fieldById[c.id!].order) || order++,
          id: fieldById[c.id!] && fieldById[c.id!].id,
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

  const removeRowIfNew = (row: Row) => {
    const index = formattedData.value.indexOf(row)

    if (index > -1 && row.rowMeta.new) {
      formattedData.value.splice(index, 1)
    }
  }

  // get current expanded row index
  function getExpandedRowIndex() {
    return formattedData.value.findIndex(
      (row: Row) => routeQuery.rowId === extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
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
      router.push({
        query: {
          ...routeQuery,
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
    navigateToSiblingRow,
    getExpandedRowIndex,
  }
}

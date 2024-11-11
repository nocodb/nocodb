import {
  type Api,
  type ColumnType,
  type PaginatedType,
  type TableType,
  type ViewType,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import { type CellRange, NavigateDir, type Row } from '#imports'

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

  const { getMeta } = useMetas()

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const router = useRouter()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

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

  const isBulkOperationInProgress = ref(false)

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
    updateOrSaveRow,
    cachedRows,
    clearCache,
    totalRows,
    bulkUpdateView,
    removeRowIfNew,
    syncCount,
    fetchChunk,
    fetchMissingChunks,
    recoverLTARRefs,
    getChunkIndex,
    selectedRows,
    chunkStates,
    isRowSortRequiredRows,
    clearInvalidRows,
    applySorting,
    CHUNK_SIZE,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      loadData,
      syncVisibleData,
    },
    where,
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
      offset?: number
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
        : await fetchSharedViewData(
            {
              sortsArr: sorts.value,
              filtersArr: nestedFilters.value,
              where: where?.value,
              offset: params.offset,
              limit: params.limit,
            },
            {
              isInfiniteScroll: true,
            },
          )

      const data = formatData(response.list, response.pageInfo)

      if (response.pageInfo.totalRows) {
        totalRows.value = response.pageInfo.totalRows
      }

      loadAggCommentsCount(data)

      return data
    } catch (error: any) {
      if (error?.response?.data.error === 'INVALID_OFFSET_VALUE') {
        return []
      }
      if (error?.response?.data?.error === 'FORMULA_ERROR') {
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

  async function deleteSelectedRows(): Promise<void> {
    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey = ''
    isBulkOperationInProgress.value = true

    for (const row of selectedRows.value) {
      const { row: rowData, rowMeta } = row

      if (!rowMeta.selected || rowMeta.new) {
        continue
      }

      const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
      const compositePkValue = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[]) as string
      const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

      if (extractedPk && compositePkValue) {
        if (!compositePrimaryKey) compositePrimaryKey = extractedPk
        removedRowsData.push({
          [compositePrimaryKey]: compositePkValue as string,
          pkData,
          row: clone(row.row),
          rowMeta,
        })
      }
    }

    if (!removedRowsData.length) return

    try {
      const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
        pks: removedRowsData.map((row) => row[compositePrimaryKey]).join(','),
      })

      for (const deleteRow of removedRowsData) {
        const rowObj = deleteRow.row
        const rowPk = rowPkData(rowObj.row, meta.value?.columns as ColumnType[])

        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => r[key] === rowPk[key])
        })

        if (!fullRecord) continue
        rowObj.row = clone(fullRecord)
      }

      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      isBulkOperationInProgress.value = false
      return message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
    }

    await updateCacheAfterDelete(removedRowsData, false)

    addUndo({
      undo: {
        fn: async (removedRowsData: Record<string, any>[]) => {
          const rowsToInsert = removedRowsData
            .map((row) => {
              const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
              row.row = { ...pkData, ...row.row }
              return row
            })
            .reverse()

          const insertedRowIds = await bulkInsertRows(rowsToInsert as Row[], undefined, true)

          if (Array.isArray(insertedRowIds)) {
            await Promise.all(rowsToInsert.map((row, _index) => recoverLTARRefs(row.row)))
          }
        },
        args: [removedRowsData],
      },
      redo: {
        fn: async (toBeRemovedData: Record<string, any>[]) => {
          try {
            isBulkOperationInProgress.value = true

            await bulkDeleteRows(toBeRemovedData.map((row) => row.pkData))

            await updateCacheAfterDelete(toBeRemovedData, false)

            await syncCount()
          } finally {
            isBulkOperationInProgress.value = false
          }
        },
        args: [removedRowsData],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })
    isBulkOperationInProgress.value = false

    await syncCount()
  }

  async function bulkInsertRows(
    rows: Row[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ): Promise<string[]> {
    if (!metaValue || !viewMetaValue) {
      throw new Error('Meta value or view meta value is undefined')
    }

    isBulkOperationInProgress.value = true

    const autoGeneratedKeys = new Set(
      metaValue.columns
        ?.filter((c) => !c.pk && (isCreatedOrLastModifiedTimeCol(c) || isCreatedOrLastModifiedByCol(c)))
        .map((c) => c.title),
    )

    try {
      const rowsToInsert = await Promise.all(
        rows.map(async (currentRow) => {
          const { missingRequiredColumns, insertObj } = await populateInsertObject({
            meta: metaValue,
            ltarState: {},
            getMeta,
            row: currentRow.row,
            undo,
          })

          if (missingRequiredColumns.size === 0) {
            for (const key of autoGeneratedKeys) {
              delete insertObj[key!]
            }
            return { insertObj, rowIndex: currentRow.rowMeta.rowIndex }
          }
          return null
        }),
      )

      const validRowsToInsert = rowsToInsert.filter(Boolean) as { insertObj: Record<string, any>; rowIndex: number }[]

      const bulkInsertedIds = await $api.dbDataTableRow.create(
        metaValue.id!,
        validRowsToInsert.map((row) => row!.insertObj),
        {
          viewId: viewMetaValue.id,
        },
      )

      validRowsToInsert.sort((a, b) => (a!.rowIndex ?? 0) - (b!.rowIndex ?? 0))

      const newCachedRows = new Map<number, Row>()

      for (const [index, row] of cachedRows.value) {
        newCachedRows.set(index, { ...row, rowMeta: { ...row.rowMeta, rowIndex: index } })
      }

      for (const { insertObj, rowIndex } of validRowsToInsert) {
        // If there's already a row at this index, shift it and all subsequent rows
        if (newCachedRows.has(rowIndex!)) {
          const rowsToShift = Array.from(newCachedRows.entries())
            .filter(([index]) => index >= rowIndex!)
            .sort((a, b) => b[0] - a[0]) // Sort in descending order

          for (const [index, row] of rowsToShift) {
            const newIndex = index + 1
            newCachedRows.set(newIndex, { ...row, rowMeta: { ...row.rowMeta, rowIndex: newIndex } })
          }
        }

        const newRow = {
          row: { ...insertObj, id: bulkInsertedIds[validRowsToInsert.indexOf({ insertObj, rowIndex })] },
          oldRow: {},
          rowMeta: { rowIndex: rowIndex!, new: false },
        }
        newCachedRows.set(rowIndex!, newRow)
      }

      cachedRows.value = newCachedRows

      totalRows.value += validRowsToInsert.length

      await syncCount()
      syncVisibleData()

      return bulkInsertedIds
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to bulk insert rows: ${errorMessage}`)
      throw error
    } finally {
      isBulkOperationInProgress.value = false
    }
  }

  async function bulkUpdateRows(
    rows: Row[],
    props: string[],
    { metaValue = meta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ): Promise<void> {
    isBulkOperationInProgress.value = true

    await Promise.all(
      rows.map(async (row) => {
        if (row.rowMeta) {
          row.rowMeta.changed = false
          await until(() => !(row.rowMeta?.new && row.rowMeta?.saving)).toMatch((v) => v)
          row.rowMeta.saving = true
        }
      }),
    )
    const pksIndex = [] as { pk: string; rowIndex: number }[]

    const updateArray = rows.map((row) => {
      const pk = rowPkData(row.row, metaValue?.columns as ColumnType[])
      const updateData = props.reduce((acc, prop) => ({ ...acc, [prop]: row.row[prop] }), {})
      pksIndex.push({
        pk: extractPkFromRow(row.row, metaValue?.columns as ColumnType[]) as string,
        rowIndex: row.rowMeta.rowIndex!,
      })
      return { ...updateData, ...pk }
    })

    try {
      const newRows = (await $api.dbTableRow.bulkUpdate(
        NOCO,
        metaValue?.base_id as string,
        metaValue?.id as string,
        updateArray,
      )) as Record<string, any>

      reloadAggregate?.trigger({ fields: props.map((p) => ({ title: p })) })

      newRows.forEach((newRow: Record<string, any>) => {
        const pk = extractPkFromRow(newRow, metaValue?.columns as ColumnType[])
        const rowIndex = pksIndex.find((pkIndex) => pkIndex.pk === pk)?.rowIndex

        if (rowIndex) {
          const row = cachedRows.value.get(rowIndex)
          if (row) {
            row.rowMeta.saving = false
            row.row = newRow
            cachedRows.value.set(rowIndex, row)
          }
        }
      })
    } catch (e) {
      message.error(await extractSdkResponseErrorMsg(e))
      isBulkOperationInProgress.value = false
      return
    } finally {
      rows.forEach((row) => {
        if (row.rowMeta) row.rowMeta.saving = false
      })
    }

    syncVisibleData()

    if (!undo) {
      addUndo({
        undo: {
          fn: async (undoRows: Row[], props: string[]) => {
            await bulkUpdateRows(
              undoRows.map((r) => ({
                ...r,
                row: r.oldRow,
                oldRow: r.row,
              })),
              props,
              undefined,
              true,
            )
          },
          args: [clone(rows), props],
        },
        redo: {
          fn: async (redoRows: Row[], props: string[]) => {
            await bulkUpdateRows(redoRows, props, undefined, true)
          },
          args: [clone(rows), props],
        },
        scope: defineViewScope({ view: viewMeta.value }),
      })
    }

    applySorting(rows)

    isBulkOperationInProgress.value = false
  }

  async function bulkUpsertRows(
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    columns: Partial<ColumnType>[],
    undo = false,
  ) {
    try {
      isBulkOperationInProgress.value = true
      const newCols = (meta.value.columns ?? []).filter((col: ColumnType) => columns.some((c) => c.title === col.title))

      const rowsToFetch = updateRows.filter((row) => !cachedRows.value.has(row.rowMeta.rowIndex!))
      const chunksToFetch = new Set(rowsToFetch.map((row) => Math.floor(row.rowMeta.rowIndex! / CHUNK_SIZE)))

      await Promise.all(Array.from(chunksToFetch).map((chunkId) => fetchChunk(chunkId)))

      const getPk = (row: Row) => extractPkFromRow(row.row, metaValue?.columns as ColumnType[])

      const ogUpdateRows = updateRows.map((_row) => {
        const row = _row ?? cachedRows.value.get((_row as Row).rowMeta.rowIndex!)

        newCols.forEach((col: ColumnType) => {
          row.oldRow[col.title!] = undefined
        })

        return clone(row)
      })

      const cleanRow = (row: any) => {
        const cleanedRow = { ...row }
        metaValue?.columns?.forEach((col) => {
          if (col.system || isVirtualCol(col)) delete cleanedRow[col.title!]
        })
        return cleanedRow
      }

      updateRows = updateRows.map((row) => {
        const cachedRow = cachedRows.value.get(row.rowMeta.rowIndex!)
        if (cachedRow) {
          return {
            ...cachedRow,
            row: { ...cachedRow.row, ...row.row },
            oldRow: cachedRow.row,
          }
        }
        return row
      })

      const bulkUpsertedRows = await $api.dbTableRow.bulkUpsert(
        NOCO,
        base.value?.id as string,
        metaValue?.id as string,
        [...insertRows.map((row) => cleanRow(row.row)), ...updateRows.map((row) => cleanRow(row.row))],
        {},
      )

      const existingPks = new Set(Array.from(cachedRows.value.values()).map((row) => getPk(row)))
      const [insertedRows, updatedRows] = bulkUpsertedRows.reduce(
        ([inserted, updated], row) => {
          const isPkExisting = existingPks.has(extractPkFromRow(row, metaValue?.columns as ColumnType[]))
          return isPkExisting
            ? [inserted, [...updated, { row, rowMeta: {}, oldRow: row }]]
            : [[...inserted, { row, rowMeta: {}, oldRow: {} }], updated]
        },
        [[], []] as [Row[], Row[]],
      )

      insertedRows.forEach((row: Row, index: number) => {
        const newIndex = totalRows.value + index
        row.rowMeta.rowIndex = newIndex
        cachedRows.value.set(newIndex, { ...row, rowMeta: { ...row.rowMeta, rowIndex: newIndex } })
      })
      updatedRows.forEach((row: Row) => {
        const existingRow = Array.from(cachedRows.value.entries()).find(([_, r]) => getPk(r) === getPk(row))
        if (existingRow) {
          cachedRows.value.set(existingRow[0], { ...row, rowMeta: { ...row.rowMeta, rowIndex: existingRow[0] } })
        }
      })

      totalRows.value += insertedRows.length

      if (!undo) {
        addUndo({
          undo: {
            fn: async (insertedRows: Row[], ogUpdateRows: Row[]) => {
              try {
                isBulkOperationInProgress.value = true

                await bulkDeleteRows(
                  insertedRows.map((row) => rowPkData(row.row, metaValue?.columns as ColumnType[]) as Record<string, any>),
                )
                await bulkUpdateRows(
                  ogUpdateRows.map((r) => ({
                    ...r,
                    row: r.oldRow,
                    oldRow: r.row,
                  })),
                  props,
                  { metaValue },
                  true,
                )
                isBulkOperationInProgress.value = true

                const columnsHash = (await $api.dbTableColumn.hash(meta.value?.id)).hash

                await $api.dbTableColumn.bulk(meta.value?.id, {
                  hash: columnsHash,
                  ops: newCols.map((col: ColumnType) => ({
                    op: 'delete',
                    column: col,
                  })),
                })

                insertedRows.forEach((row) => {
                  cachedRows.value.delete(row.rowMeta.rowIndex!)
                })

                totalRows.value = totalRows.value - insertedRows.length

                syncVisibleData?.()

                await getMeta(meta.value?.id as string, true)
              } catch (e) {
              } finally {
                isBulkOperationInProgress.value = false
              }
            },
            args: [clone(insertedRows), clone(ogUpdateRows)],
          },
          redo: {
            fn: async (insertRows: Row[], updateRows: Row[]) => {
              try {
                isBulkOperationInProgress.value = true
                const columnsHash = (await $api.dbTableColumn.hash(meta.value?.id)).hash

                await $api.dbTableColumn.bulk(meta.value?.id, {
                  hash: columnsHash,
                  ops: newCols.map((col: ColumnType) => ({
                    op: 'add',
                    column: col,
                  })),
                })

                await bulkUpsertRows(insertRows, updateRows, props, { metaValue, viewMetaValue }, columns, true)
                isBulkOperationInProgress.value = true

                await getMeta(meta.value?.id as string, true)

                syncVisibleData?.()
              } finally {
                isBulkOperationInProgress.value = false
              }
            },
            args: [clone(insertedRows), clone(updatedRows)],
          },

          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      syncVisibleData?.()
      await syncCount()
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      isBulkOperationInProgress.value = false
    }
  }

  async function updateCacheAfterDelete(rowsToDelete: Record<string, any>[], nested = true): Promise<void> {
    const maxCachedIndex = Math.max(...cachedRows.value.keys())
    const newCachedRows = new Map<number, Row>()

    const deleteSet = new Set(rowsToDelete.map((row) => (nested ? row.row : row).rowMeta.rowIndex))

    let deletionCount = 0
    let lastIndex = -1

    for (let i = 0; i <= maxCachedIndex + 1; i++) {
      if (deleteSet.has(i)) {
        deletionCount++
        continue
      }

      if (cachedRows.value.has(i)) {
        const row = cachedRows.value.get(i)
        if (row) {
          const newIndex = i - deletionCount
          if (lastIndex !== -1 && newIndex - lastIndex > 1) {
            chunkStates.value[getChunkIndex(lastIndex)] = undefined
          }

          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
          lastIndex = newIndex
        }
      }
    }

    if (lastIndex !== -1) {
      chunkStates.value[getChunkIndex(lastIndex)] = undefined
    }

    cachedRows.value = newCachedRows
    totalRows.value = Math.max(0, totalRows.value - rowsToDelete.length)

    await syncCount()
    syncVisibleData?.()
  }

  async function deleteRangeOfRows(cellRange: CellRange): Promise<void> {
    if (!cellRange._start || !cellRange._end) return
    isBulkOperationInProgress.value = true

    const start = Math.min(cellRange._start.row, cellRange._end.row)
    const end = Math.max(cellRange._start.row, cellRange._end.row)

    const rowsToDelete: Record<string, any>[] = []
    let compositePrimaryKey = ''

    const uncachedRows = Array.from({ length: end - start + 1 }, (_, i) => start + i).filter(
      (index) => !cachedRows.value.has(index),
    )

    if (uncachedRows.length > 0) {
      await fetchMissingChunks(uncachedRows[0], uncachedRows[uncachedRows.length - 1])
    }

    for (let i = start; i <= end; i++) {
      const cachedRow = cachedRows.value.get(i)
      if (!cachedRow) {
        console.warn(`Record at index ${i} not found in local cache`)
        continue
      }

      const { row: rowData, rowMeta } = cachedRow

      if (!rowMeta.new) {
        const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
        const compositePkValue = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[])
        const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

        if (extractedPk && compositePkValue) {
          if (!compositePrimaryKey) compositePrimaryKey = extractedPk

          rowsToDelete.push({
            [compositePrimaryKey]: compositePkValue,
            pkData,
            row: { ...cachedRow },
            rowIndex: i,
          })
        }
      }
    }

    if (!rowsToDelete.length) return

    const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
      pks: rowsToDelete.map((row) => row[compositePrimaryKey]).join(','),
    })

    try {
      for (const deleteRow of rowsToDelete) {
        const rowObj = deleteRow.row
        const rowPk = rowPkData(rowObj.row, meta.value?.columns as ColumnType[])

        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => r[key] === rowPk[key])
        })

        if (!fullRecord) {
          console.warn(`Full record not found for row with index ${deleteRow.rowIndex}`)
          continue
        }
        rowObj.row = fullRecord
      }

      await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      isBulkOperationInProgress.value = false
      throw e
    }

    addUndo({
      undo: {
        fn: async (deletedRows: Record<string, any>[]) => {
          const rowsToInsert = deletedRows
            .map((row) => {
              const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
              row.row = { ...pkData, ...row.row }
              return row
            })
            .reverse()

          const insertedRowIds = await bulkInsertRows(
            rowsToInsert.map((row) => row.row),
            undefined,
            true,
          )

          if (Array.isArray(insertedRowIds)) {
            await Promise.all(rowsToInsert.map((row, _index) => recoverLTARRefs(row.row)))
          }
        },
        args: [rowsToDelete],
      },
      redo: {
        fn: async (rowsToDelete: Record<string, any>[]) => {
          await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))
          await updateCacheAfterDelete(rowsToDelete)
        },
        args: [rowsToDelete],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })
    await updateCacheAfterDelete(rowsToDelete)
    isBulkOperationInProgress.value = false
  }

  async function bulkDeleteRows(
    rows: Record<string, string>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ): Promise<any> {
    try {
      const bulkDeletedRowsData = await $api.dbDataTableRow.delete(metaValue?.id as string, rows.length === 1 ? rows[0] : rows, {
        viewId: viewMetaValue?.id as string,
      })
      reloadAggregate?.trigger()

      return rows.length === 1 && bulkDeletedRowsData ? [bulkDeletedRowsData] : bulkDeletedRowsData
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Bulk delete failed: ${errorMessage}`)
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
    bulkUpsertRows,
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
    clearInvalidRows,
    applySorting,
    isRowSortRequiredRows,
    isBulkOperationInProgress,
  }
}

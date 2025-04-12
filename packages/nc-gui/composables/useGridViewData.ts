import {
  type ColumnType,
  type TableType,
  type ViewType,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isVirtualCol,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { EventHook } from '@vueuse/core'
import { findGroupByPath } from '../components/smartsheet/grid/canvas/utils/groupby'
import type { CanvasGroup } from '../lib/types'
import { useInfiniteGroups } from './useInfiniteGroups'
import { type CellRange, type Row } from '#imports'

export function useGridViewData(
  _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
  where?: ComputedRef<string | undefined>,
  reloadVisibleDataHook?: EventHook<void>,
) {
  const tablesStore = useTablesStore()
  const { activeTable } = storeToRefs(tablesStore)
  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

  const meta = computed(() => _meta.value || activeTable.value)

  const { t } = useI18n()

  const optimisedQuery = useState('optimisedQuery', () => true)

  const isPublic = inject(IsPublicInj, ref(false))

  const { getMeta } = useMetas()

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const { base } = storeToRefs(useBase())

  const { $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const isBulkOperationInProgress = ref(false)

  const {
    cachedGroups,
    totalGroups,
    toggleExpand,
    groupByColumns,
    isGroupBy,
    buildNestedWhere,
    clearGroupCache,
    syncCount: groupSyncCount,
    fetchMissingGroupChunks,
    updateGroupAggregations,
  } = useInfiniteGroups(viewMeta, meta, where, {
    syncVisibleData,
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
    recoverLTARRefs,
    getChunkIndex,
    selectedRows,
    chunkStates,
    isRowSortRequiredRows,
    clearInvalidRows,
    applySorting,
    CHUNK_SIZE,
    isLastRow,
    isFirstRow,
    getExpandedRowIndex,
    loadData,
    updateRecordOrder,
    selectedAllRecords,
    loadAggCommentsCount,
    navigateToSiblingRow,
    getRows,
    getDataCache,
    groupDataCache,
  } = useInfiniteData({
    meta,
    viewMeta,
    callbacks: {
      syncVisibleData,
      getCount,
      getWhereFilter: getGroupFilter,
      reloadAggregate: triggerAggregateReload,
      findGroupByPath: (path: Array<number>) => {
        return findGroupByPath(cachedGroups.value, path)
      },
    },
    groupByColumns,
    where,
    isPublic,
  })

  function triggerAggregateReload(params: {
    fields?: Array<{ title: string; aggregation?: string | undefined }>
    path: Array<number>
  }) {
    const { fields, path } = params

    reloadAggregate?.trigger(params)

    if (!isGroupBy.value || !appInfo.value?.ee) {
      return
    }

    function collectChildGroups(group: CanvasGroup): CanvasGroup[] {
      const result: CanvasGroup[] = [group]
      if (group.groups && group.groups.size > 0) {
        for (const childGroup of group.groups.values()) {
          result.push(...collectChildGroups(childGroup))
        }
      }
      return result
    }

    const targetGroup = findGroupByPath(cachedGroups.value, path)
    if (!targetGroup) return

    const groupsToUpdate = collectChildGroups(targetGroup)
    updateGroupAggregations(groupsToUpdate, fields)

    if (path.length > 1) {
      for (let i = path.length - 1; i > 0; i--) {
        const parentPath = path.slice(0, i)
        const parentGroup = findGroupByPath(cachedGroups.value, parentPath)
        if (parentGroup) {
          const parentAndChildren = collectChildGroups(parentGroup)
          updateGroupAggregations(parentAndChildren, fields)
        }
      }
    }
  }

  reloadAggregate?.on((v: Record<string, any> = {}) => {
    const { path, fields } = v
    if (!path?.length && isGroupBy.value) {
      const allGroups: CanvasGroup[] = []

      function collectAllGroups(groups: Map<number, CanvasGroup>) {
        const groupArray = Array.from(groups.values())
        allGroups.push(...groupArray)

        for (const group of groupArray) {
          if (group.groups && group.groups.size > 0) {
            collectAllGroups(group.groups)
          }
        }
      }

      collectAllGroups(cachedGroups.value)

      if (allGroups.length) {
        updateGroupAggregations(allGroups, fields)
      }
    }
  })

  function getCount(path?: Array<number>) {
    if (!path?.length) return
    let currentGroups = cachedGroups.value
    const pathCopy = [...path]

    for (let i = 0; i < path.length - 1; i++) {
      const groupIndex = pathCopy[i]
      const group = currentGroups.get(groupIndex)

      if (!group || !group.groups) {
        console.warn(`Invalid path: Group at index ${groupIndex} not found or has no subgroups`)
        return undefined
      }

      currentGroups = group.groups
    }

    const finalIndex = pathCopy[path.length - 1]
    const targetGroup = currentGroups.get(finalIndex)

    if (!targetGroup) {
      console.warn(`Target group at path [${path}] not found`)
      return undefined
    }

    return targetGroup.count
  }

  function getGroupFilter(path: Array<number> = []) {
    const group = findGroupByPath(cachedGroups.value, path)

    return buildNestedWhere(group, where?.value)
  }

  function syncVisibleData() {
    reloadVisibleDataHook?.trigger()
  }

  async function deleteSelectedRows(path: Array<number> = []): Promise<void> {
    let removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey = ''
    isBulkOperationInProgress.value = true
    const dataCache = getDataCache(path)

    for (const row of dataCache.selectedRows.value) {
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
          row: clone(rowData),
          rowMeta,
        })
      }
    }

    if (!removedRowsData.length) return

    try {
      const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
        pks: removedRowsData.map((row) => row[compositePrimaryKey]).join(','),
        getHiddenColumns: true,
        limit: removedRowsData.length,
      })

      removedRowsData = removedRowsData.map((row) => {
        const rowObj = row.row
        const rowPk = rowPkData(rowObj, meta.value?.columns as ColumnType[])

        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => r[key] === rowPk[key])
        })

        if (!fullRecord) return { ...row }
        return {
          ...row,
          row: { ...fullRecord },
        }
      })

      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      isBulkOperationInProgress.value = false
      return message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
    }

    await updateCacheAfterDelete(removedRowsData, false, path)

    addUndo({
      undo: {
        fn: async (removedRowsData: Record<string, any>[], path: Array<number>) => {
          const rowsToInsert = removedRowsData.reverse()

          const insertedRowIds = await bulkInsertRows(rowsToInsert as Row[], undefined, true, path)

          if (Array.isArray(insertedRowIds)) {
            await Promise.all(rowsToInsert.map((row, _index) => recoverLTARRefs(row.row)))
          }
        },
        args: [removedRowsData, clone(path)],
      },
      redo: {
        fn: async (toBeRemovedData: Record<string, any>[], path: Array<number>) => {
          try {
            isBulkOperationInProgress.value = true

            await bulkDeleteRows(toBeRemovedData.map((row) => row.pkData))

            await updateCacheAfterDelete(toBeRemovedData, false, path)

            await syncCount(path)
          } finally {
            isBulkOperationInProgress.value = false
          }
        },
        args: [removedRowsData, clone(path)],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })
    isBulkOperationInProgress.value = false

    await syncCount(path)
  }

  async function bulkInsertRows(
    rows: Row[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
    path: Array<number> = [],
  ): Promise<string[]> {
    if (!metaValue || !viewMetaValue) {
      throw new Error('Meta value or view meta value is undefined')
    }

    const dataCache = getDataCache(path)

    isBulkOperationInProgress.value = true

    const autoGeneratedKeys = new Set(
      metaValue.columns
        ?.filter((c) => !c.pk && (isCreatedOrLastModifiedTimeCol(c) || isCreatedOrLastModifiedByCol(c)))
        .map((c) => c.title!),
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
            const newInsertObj = { ...insertObj }
            for (const key of autoGeneratedKeys) {
              delete newInsertObj[key]
            }
            return {
              insertObj: newInsertObj,
              rowIndex: currentRow.rowMeta.rowIndex,
            }
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
          undo,
        },
      )

      validRowsToInsert.sort((a, b) => (a!.rowIndex ?? 0) - (b!.rowIndex ?? 0))

      const newCachedRows = new Map<number, Row>()

      for (const [index, row] of dataCache.cachedRows.value) {
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

      const indices = new Set<number>()
      for (const [_, row] of newCachedRows) {
        if (indices.has(row.rowMeta.rowIndex)) {
          console.error(`Op: bulkInsertRows ${undo}:  Duplicate index detected:`, row.rowMeta.rowIndex)
          break
        }
        indices.add(row.rowMeta.rowIndex)
      }

      dataCache.cachedRows.value = newCachedRows

      dataCache.totalRows.value += validRowsToInsert.length

      await syncCount(path)
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
    path: Array<number> = [],
  ): Promise<void> {
    isBulkOperationInProgress.value = true

    const dataCache = getDataCache(path)

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

      triggerAggregateReload({ fields: props.map((p) => ({ title: p })), path })

      newRows.forEach((newRow: Record<string, any>) => {
        const pk = extractPkFromRow(newRow, metaValue?.columns as ColumnType[])
        const rowIndex = pksIndex.find((pkIndex) => pkIndex.pk === pk)?.rowIndex

        if (rowIndex !== undefined && rowIndex !== null) {
          const row = dataCache.cachedRows.value.get(rowIndex)
          if (row) {
            row.rowMeta.saving = false
            row.row = {
              ...row.row,
              ...newRow,
            }
            dataCache.cachedRows.value.set(rowIndex, row)
          }
        }
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
      isBulkOperationInProgress.value = false
      return
    } finally {
      rows.forEach((row) => {
        if (row.rowMeta) row.rowMeta.saving = false
      })
    }
    if (!undo) {
      addUndo({
        undo: {
          fn: async (undoRows: Row[], props: string[], path: Array<number>) => {
            await bulkUpdateRows(
              undoRows.map((r) => ({
                ...r,
                row: r.oldRow,
                oldRow: r.row,
              })),
              props,
              undefined,
              true,
              path,
            )
          },
          args: [clone(rows), props, clone(path)],
        },
        redo: {
          fn: async (redoRows: Row[], props: string[], path: Array<number>) => {
            await bulkUpdateRows(redoRows, props, undefined, true, path)
          },
          args: [clone(rows), props, clone(path)],
        },
        scope: defineViewScope({ view: viewMeta.value }),
      })
    }

    applySorting(rows)
    syncVisibleData()
    reloadViewDataHook?.trigger()
    isBulkOperationInProgress.value = false
  }

  async function bulkUpsertRows(
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    columns: Partial<ColumnType>[],
    undo = false,
    path: Array<number> = [],
  ) {
    const dataCache = getDataCache(path)

    try {
      isBulkOperationInProgress.value = true
      const newCols = (meta.value.columns ?? []).filter((col: ColumnType) => columns.some((c) => c.title === col.title))

      const rowsToFetch = updateRows.filter((row) => !dataCache.cachedRows.value.has(row.rowMeta.rowIndex!))
      const chunksToFetch = new Set(rowsToFetch.map((row) => Math.floor(row.rowMeta.rowIndex! / CHUNK_SIZE)))

      await Promise.all(Array.from(chunksToFetch).map((chunkId) => fetchChunk(chunkId, path)))

      const getPk = (row: Row) => extractPkFromRow(row.row, metaValue?.columns as ColumnType[])

      const ogUpdateRows = updateRows.map((_row) => {
        const row = _row ?? dataCache.cachedRows.value.get((_row as Row).rowMeta.rowIndex!)

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
        const cachedRow = dataCache.cachedRows.value.get(row.rowMeta.rowIndex!)
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

      const existingPks = new Set(Array.from(dataCache.cachedRows.value.values()).map((row) => getPk(row)))
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
        const newIndex = dataCache.totalRows.value + index
        row.rowMeta.rowIndex = newIndex
        dataCache.cachedRows.value.set(newIndex, { ...row, rowMeta: { ...row.rowMeta, rowIndex: newIndex } })
      })
      updatedRows.forEach((row: Row) => {
        const existingRow = Array.from(dataCache.cachedRows.value.entries()).find(([_, r]) => getPk(r) === getPk(row))
        if (existingRow) {
          dataCache.cachedRows.value.set(existingRow[0], { ...row, rowMeta: { ...row.rowMeta, rowIndex: existingRow[0] } })
        }
      })

      dataCache.totalRows.value += insertedRows.length

      if (!undo) {
        addUndo({
          undo: {
            fn: async (insertedRows: Row[], ogUpdateRows: Row[], path: Array<number>) => {
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
                  path,
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
                  dataCache.cachedRows.value.delete(row.rowMeta.rowIndex!)
                })

                dataCache.totalRows.value = dataCache.totalRows.value - insertedRows.length

                syncVisibleData()

                await getMeta(meta.value?.id as string, true)
              } catch (e) {
              } finally {
                isBulkOperationInProgress.value = false
              }
            },
            args: [clone(insertedRows), clone(ogUpdateRows), clone(path)],
          },
          redo: {
            fn: async (insertRows: Row[], updateRows: Row[], path: Array<number>) => {
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

                await bulkUpsertRows(insertRows, updateRows, props, { metaValue, viewMetaValue }, columns, true, path)
                isBulkOperationInProgress.value = true

                await getMeta(meta.value?.id as string, true)

                syncVisibleData()
              } finally {
                isBulkOperationInProgress.value = false
              }
            },
            args: [clone(insertedRows), clone(updatedRows), clone(path)],
          },

          scope: defineViewScope({ view: viewMeta.value }),
        })
      }
      reloadViewDataHook?.trigger()
      syncVisibleData()
      await syncCount(path)
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      isBulkOperationInProgress.value = false
    }
  }

  async function updateCacheAfterDelete(
    rowsToDelete: Record<string, any>[],
    nested = true,
    path: Array<number> = [],
  ): Promise<void> {
    const dataCache = getDataCache(path)
    const maxCachedIndex = Math.max(...dataCache.cachedRows.value.keys())
    const newCachedRows = new Map<number, Row>()

    const deleteSet = new Set(rowsToDelete.map((row) => (nested ? row.row : row).rowMeta.rowIndex))
    const affectedChunks = new Set<number>()
    let deletionCount = 0

    for (let i = 0; i <= maxCachedIndex + 1; i++) {
      if (deleteSet.has(i)) {
        deletionCount++
        affectedChunks.add(getChunkIndex(i))
        continue
      }

      if (dataCache.cachedRows.value.has(i)) {
        const row = dataCache.cachedRows.value.get(i)
        if (row) {
          const newIndex = i - deletionCount

          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
          affectedChunks.add(getChunkIndex(i))
          affectedChunks.add(getChunkIndex(newIndex))
        }
      }
    }

    const rowsByChunk = new Map<number, number>()
    for (const [_, row] of newCachedRows) {
      const chunkIndex = getChunkIndex(row.rowMeta.rowIndex)
      rowsByChunk.set(chunkIndex, (rowsByChunk.get(chunkIndex) || 0) + 1)
    }

    for (const chunkIndex of affectedChunks) {
      if (!rowsByChunk.has(chunkIndex) || rowsByChunk.get(chunkIndex) < CHUNK_SIZE) {
        dataCache.chunkStates.value[chunkIndex] = undefined
      }
    }

    const indices = new Set<number>()
    for (const [_, row] of newCachedRows) {
      if (indices.has(row.rowMeta.rowIndex)) {
        console.error(`Op: updateCacheAfterDelete: Duplicate index detected:`, row.rowMeta.rowIndex)
        break
      }
      indices.add(row.rowMeta.rowIndex)
    }

    dataCache.cachedRows.value = newCachedRows
    dataCache.totalRows.value = Math.max(0, dataCache.totalRows.value - rowsToDelete.length)

    await syncCount(path)
    syncVisibleData()
  }

  async function deleteRangeOfRows(cellRange: CellRange, path: Array<number> = []): Promise<void> {
    if (!cellRange._start || !cellRange._end) return
    isBulkOperationInProgress.value = true
    const dataCache = getDataCache(path)

    const start = Math.min(cellRange._start.row, cellRange._end.row)
    const end = Math.max(cellRange._start.row, cellRange._end.row)

    let rowsToDelete: Record<string, any>[] = []
    let compositePrimaryKey = ''

    await getRows(start, end, path)

    for (let i = start; i <= end; i++) {
      const cachedRow = dataCache.cachedRows.value.get(i)
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
            ...cachedRow,
            rowIndex: i,
          })
        }
      }
    }

    if (!rowsToDelete.length) return

    const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
      pks: rowsToDelete.map((row) => row[compositePrimaryKey]).join(','),
      getHiddenColumns: 'true',
      limit: rowsToDelete.length,
    })

    try {
      rowsToDelete = rowsToDelete.map((row) => {
        const rowObj = row.row
        const rowPk = rowPkData(rowObj, meta.value?.columns as ColumnType[])

        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => r[key] === rowPk[key])
        })

        if (!fullRecord) {
          console.warn(`Full record not found for row with index ${row.rowMeta.rowIndex}`)
          return row
        }
        row.row = fullRecord
        return row
      })

      await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      isBulkOperationInProgress.value = false
      throw e
    }

    addUndo({
      undo: {
        fn: async (deletedRows: Record<string, any>[], path: Array<number>) => {
          const rowsToInsert = deletedRows.reverse()

          const insertedRowIds = await bulkInsertRows(rowsToInsert, undefined, true, path)

          if (Array.isArray(insertedRowIds)) {
            await Promise.all(rowsToInsert.map((row, _index) => recoverLTARRefs(row.row)))
          }
        },
        args: [rowsToDelete, clone(path)],
      },
      redo: {
        fn: async (rowsToDelete: Record<string, any>[], path: Array<number>) => {
          await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))
          await updateCacheAfterDelete(rowsToDelete, false, path)
        },
        args: [rowsToDelete, clone(path)],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })
    await updateCacheAfterDelete(rowsToDelete, false, path)
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

      triggerAggregateReload({ path: [] })

      return rows.length === 1 && bulkDeletedRowsData ? [bulkDeletedRowsData] : bulkDeletedRowsData
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Bulk delete failed: ${errorMessage}`)
    }
  }

  async function bulkDeleteAll(path: Array<number> = []) {
    try {
      isBulkOperationInProgress.value = true

      await $api.dbTableRow.bulkDeleteAll('noco', base.value.id!, meta.value.id!, {
        where: where?.value,
        viewId: viewMeta.value?.id,
      })
    } catch (error) {
    } finally {
      clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, path)
      await syncCount(path)
      syncVisibleData?.()
      isBulkOperationInProgress.value = false
    }
  }

  return {
    cachedRows,
    loadData,
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
    bulkDeleteAll,
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
    updateRecordOrder,
    selectedAllRecords,
    getRows,
    getDataCache,
    groupDataCache,
    // Groupby
    cachedGroups,
    totalGroups,
    toggleExpand,
    groupByColumns,
    isGroupBy,
    groupSyncCount,
    fetchMissingGroupChunks,
    clearGroupCache,
  }
}

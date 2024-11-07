import type { ComputedRef, Ref } from 'vue'
import {
  type Api,
  type ColumnType,
  type LinkToAnotherRecordType,
  type RelationTypes,
  type TableType,
  UITypes,
  type ViewType,
  extractFilterFromXwhere,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
} from 'nocodb-sdk'
import type { Row } from '../lib/types'
import { validateRowFilters } from '../utils/dataUtils'
import type { CellRange } from './useMultiSelect/cellRange'

export function useInfiniteData(args: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>
  callbacks: {
    loadData?: (
      params: Parameters<Api<any>['dbViewRow']['list']>[4] & {
        limit?: number
        offset?: number
      },
    ) => Promise<Row[] | undefined>
    syncVisibleData?: () => void
  }
  where?: ComputedRef<string | undefined>
}) {
  const { meta, viewMeta, callbacks, where } = args

  const NOCO = 'noco'

  const { $api } = useNuxtApp()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const { t } = useI18n()

  const { fetchCount } = useSharedView()

  const { getBaseType } = useBase()

  const { getMeta, metas } = useMetas()

  const { base } = storeToRefs(useBase())

  const isPublic = inject(IsPublicInj, ref(false))

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const { nestedFilters, allFilters, xWhere, sorts } = useSmartsheetStoreOrThrow()

  const columnsByAlias = computed(() => {
    if (!meta.value?.columns?.length) return {}
    return meta.value?.columns.reduce((acc, column) => {
      acc[column.title!] = column
      return acc
    }, {} as Record<string, ColumnType>)
  })
  const columnsById = computed(() => {
    if (!meta.value?.columns?.length) return {}
    return meta.value?.columns.reduce((acc, column) => {
      acc[column.id!] = column
      return acc
    }, {} as Record<string, ColumnType>)
  })

  const computedWhereFilter = computed(() => {
    const filter = extractFilterFromXwhere(xWhere.value ?? '', columnsByAlias.value)

    return filter.map((f) => {
      return { ...f, value: f.value ? f.value?.toString().replace(/(^%)(.*?)(%$)/, '$2') : f.value }
    })
  })

  const cachedRows = ref<Map<number, Row>>(new Map())

  const totalRows = ref(0)

  const MAX_CACHE_SIZE = 200

  const CHUNK_SIZE = 50

  const chunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])

  const getChunkIndex = (rowIndex: number) => Math.floor(rowIndex / CHUNK_SIZE)

  const fetchChunk = async (chunkId: number) => {
    if (chunkStates.value[chunkId]) return

    if (!callbacks?.loadData) return

    chunkStates.value[chunkId] = 'loading'
    const offset = chunkId * CHUNK_SIZE

    try {
      const newItems = await callbacks.loadData({ offset, limit: CHUNK_SIZE })
      if (!newItems) {
        chunkStates.value[chunkId] = undefined
        return
      }
      newItems.forEach((item) => {
        cachedRows.value.set(item.rowMeta.rowIndex!, item)
      })
      chunkStates.value[chunkId] = 'loaded'
    } catch (error) {
      console.error('Error fetching chunk:', error)
      chunkStates.value[chunkId] = undefined
    }
  }

  const clearCache = (visibleStartIndex: number, visibleEndIndex: number) => {
    if (visibleEndIndex === Number.POSITIVE_INFINITY && visibleStartIndex === Number.NEGATIVE_INFINITY) {
      cachedRows.value.clear()
      chunkStates.value = []
      return
    }

    if (cachedRows.value.size <= MAX_CACHE_SIZE) return

    const safeStartIndex = Math.max(0, visibleStartIndex)
    const safeEndIndex = Math.min(totalRows.value - 1, visibleEndIndex)
    const safeStartChunk = getChunkIndex(safeStartIndex)
    const safeEndChunk = getChunkIndex(safeEndIndex)

    const newCachedRows = new Map<number, Row>()
    let keptCount = 0

    cachedRows.value.forEach((row, index) => {
      const chunk = getChunkIndex(index)
      if (
        (chunk >= safeStartChunk && chunk <= safeEndChunk) ||
        row.rowMeta.selected ||
        row.rowMeta.new ||
        keptCount < MAX_CACHE_SIZE
      ) {
        newCachedRows.set(index, row)
        keptCount++
      }
    })

    cachedRows.value = newCachedRows

    chunkStates.value = chunkStates.value.map((state, chunkId) =>
      chunkId >= safeStartChunk && chunkId <= safeEndChunk ? state : undefined,
    )
  }

  const selectedRows = computed<Row[]>(() => {
    return Array.from(cachedRows.value.values()).filter((row) => row.rowMeta?.selected)
  })

  const isRowSortRequiredRows = computed(() => {
    return Array.from(cachedRows.value.values()).filter((row) => row.rowMeta?.isRowOrderUpdated)
  })

  function clearInvalidRows() {
    const sortedEntries = Array.from(cachedRows.value.entries()).sort(([indexA], [indexB]) => indexA - indexB)

    const invalidIndexes = sortedEntries.filter(([_, row]) => row.rowMeta.isValidationFailed).map(([index]) => index)

    if (invalidIndexes.length === 0) return

    for (const index of invalidIndexes) {
      cachedRows.value.delete(index)
    }

    const newCachedRows = new Map<number, Row>()
    let newIndex = 0

    for (const [oldIndex, row] of sortedEntries) {
      if (!invalidIndexes.includes(oldIndex)) {
        row.rowMeta.rowIndex = newIndex
        newCachedRows.set(newIndex, row)
        newIndex++
      }
    }

    // Update chunk state for the last shifted row in the chunk
    chunkStates.value[getChunkIndex(Math.max(...invalidIndexes))] = undefined

    cachedRows.value = newCachedRows

    totalRows.value = Math.max(0, (totalRows.value || 0) - invalidIndexes.length)

    callbacks?.syncVisibleData?.()
  }

  const willSortOrderChange = ({ row, newData }: { row: Row; newData: Record<string, any> }): boolean => {
    if (!sorts.value.length) return false

    const currentIndex = row.rowMeta.rowIndex!
    if (currentIndex === undefined) return true

    const indices = Array.from(cachedRows.value.keys()).sort((a, b) => a - b)
    const currentPos = indices.indexOf(currentIndex)
    const prevRow = currentPos > 0 ? cachedRows.value.get(indices[currentPos - 1]) : null
    const nextRow = currentPos < indices.length - 1 ? cachedRows.value.get(indices[currentPos + 1]) : null

    const updatedRow = {
      ...row,
      row: {
        ...row.row,
        ...newData,
      },
    }

    if (prevRow) {
      let shouldBeBefore = false
      let isDifferent = false

      for (const sort of sorts.value) {
        const column = columnsById.value[sort.fk_column_id!]
        if (!column?.title) continue

        const direction = sort.direction || 'asc'
        const comparison = sortByUIType({
          uidt: column.uidt as UITypes,
          a: updatedRow.row[column.title],
          b: prevRow.row[column.title],
          options: { direction },
        })

        if (comparison !== 0) {
          isDifferent = true
          shouldBeBefore = comparison < 0
          break
        }
      }

      if (isDifferent && shouldBeBefore) return true
    }

    if (nextRow) {
      let shouldBeAfter = false
      let isDifferent = false

      for (const sort of sorts.value) {
        const column = columnsById.value[sort.fk_column_id!]
        if (!column?.title) continue

        const direction = sort.direction || 'asc'
        const comparison = sortByUIType({
          uidt: column.uidt as UITypes,
          a: updatedRow.row[column.title],
          b: nextRow.row[column.title],
          options: { direction },
        })

        if (comparison !== 0) {
          isDifferent = true
          shouldBeAfter = comparison > 0
          break
        }
      }

      if (isDifferent && shouldBeAfter) return true
    }

    return false
  }

  const getContinuousRanges = (cachedRows: Map<number, Row>) => {
    const indexes = Array.from(cachedRows.keys()).sort((a, b) => a - b)
    const ranges: { start: number; end: number }[] = []

    let rangeStart = indexes[0]
    let prev = indexes[0]

    for (let i = 1; i <= indexes.length; i++) {
      const current = indexes[i]
      if (current !== prev + 1) {
        ranges.push({ start: rangeStart, end: prev })
        rangeStart = current
      }
      prev = current
    }

    return ranges
  }

  const applySorting = (rows: Row | Row[]) => {
    if (!sorts.value.length) return
    const orderedSorts = sorts.value.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const inputRows = Array.isArray(rows) ? rows : [rows]
    const ranges = getContinuousRanges(cachedRows.value)

    inputRows.forEach((inputRow) => {
      const originalIndex = inputRow.rowMeta.rowIndex!
      const sourceRange = ranges.find((r) => originalIndex >= r.start && originalIndex <= r.end)
      if (!sourceRange) return

      const rangeEntries = Array.from(cachedRows.value.entries())
        .filter(([index]) => index >= sourceRange.start && index <= sourceRange.end)
        .map(([index, row]) => ({
          currentIndex: index,
          row,
          pk: extractPkFromRow(row.row, meta.value?.columns),
        }))

      const sortedRangeEntries = rangeEntries.sort((a, b) => {
        for (const sort of orderedSorts) {
          const column = columnsById.value[sort.fk_column_id!]?.title
          if (!column) continue

          const direction = sort.direction || 'asc'
          const comparison = sortByUIType({
            uidt: columnsById.value[sort.fk_column_id!].uidt as UITypes,
            a: a.row.row[column],
            b: b.row.row[column],
            options: { direction },
          })

          if (comparison !== 0) return comparison
        }
        return a.currentIndex - b.currentIndex
      })

      const entry = sortedRangeEntries.find((e) => e.pk === extractPkFromRow(inputRow.row, meta.value?.columns))

      if (!entry) return

      const targetIndex = sourceRange.start + sortedRangeEntries.indexOf(entry)

      const newCachedRows = new Map(cachedRows.value)

      if (targetIndex !== originalIndex) {
        if (targetIndex < originalIndex) {
          // Move up
          for (let i = originalIndex - 1; i >= targetIndex; i--) {
            const row = newCachedRows.get(i)
            if (row) {
              row.rowMeta.rowIndex = i + 1
              row.rowMeta.isRowOrderUpdated = false
              newCachedRows.set(i + 1, row)
            }
          }
        } else {
          // Move down
          for (let i = originalIndex + 1; i <= targetIndex; i++) {
            const row = newCachedRows.get(i)
            if (row) {
              row.rowMeta.rowIndex = i - 1
              row.rowMeta.isRowOrderUpdated = false
              newCachedRows.set(i - 1, row)
            }
          }
        }

        // Place the input row at its new position
        inputRow.rowMeta.rowIndex = targetIndex
        inputRow.rowMeta.isRowOrderUpdated = false
        newCachedRows.set(targetIndex, inputRow)

        // Update chunk state
        const chunkIndex = getChunkIndex(targetIndex)
        chunkStates.value[chunkIndex] = undefined
      }

      cachedRows.value = newCachedRows
    })
  }

  function addEmptyRow(newRowIndex = totalRows.value, metaValue = meta.value) {
    if (cachedRows.value.has(newRowIndex)) {
      const entriesToShift = Array.from(cachedRows.value.entries())
        .filter(([index]) => index >= newRowIndex)
        .sort((a, b) => b[0] - a[0])

      for (const [index, rowData] of entriesToShift) {
        const shiftedRowData = {
          ...rowData,
          rowMeta: {
            ...rowData.rowMeta,
            rowIndex: index + 1,
          },
        }
        cachedRows.value.set(index + 1, shiftedRowData)
      }
    }

    const newRow = {
      row: { ...rowDefaultData(metaValue?.columns) },
      oldRow: {},
      rowMeta: { new: true, rowIndex: newRowIndex },
    }
    cachedRows.value.set(newRowIndex, newRow)

    totalRows.value++
    callbacks?.syncVisibleData?.()

    return newRow
  }

  const linkRecord = async (
    rowId: string,
    relatedRowId: string,
    column: ColumnType,
    type: RelationTypes,
    { metaValue = meta.value }: { metaValue?: TableType } = {},
  ): Promise<void> => {
    try {
      await $api.dbTableRow.nestedAdd(
        NOCO,
        base.value.id as string,
        metaValue?.id as string,
        encodeURIComponent(rowId),
        type,
        column.title as string,
        encodeURIComponent(relatedRowId),
      )
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`Failed to link record: ${errorMessage}`)
      throw e
    }
    callbacks?.syncVisibleData?.()
  }

  const recoverLTARRefs = async (row: Record<string, any>, { metaValue = meta.value }: { metaValue?: TableType } = {}) => {
    const id = extractPkFromRow(row, metaValue?.columns as ColumnType[])

    if (!id) return

    for (const column of metaValue?.columns ?? []) {
      if (column.uidt !== UITypes.LinkToAnotherRecord) continue

      const colOptions = column.colOptions as LinkToAnotherRecordType

      const relatedTableMeta = metas.value?.[colOptions?.fk_related_model_id as string]

      if (isHm(column) || isMm(column)) {
        const relatedRows = (row[column.title!] ?? []) as Record<string, any>[]

        for (const relatedRow of relatedRows) {
          const relatedId = extractPkFromRow(relatedRow, relatedTableMeta?.columns as ColumnType[])
          if (relatedId) {
            await linkRecord(id, relatedId, column, colOptions.type as RelationTypes, { metaValue: relatedTableMeta })
          }
        }
      } else if (isBt(column) && row[column.title!]) {
        const relatedId = extractPkFromRow(row[column.title!] as Record<string, any>, relatedTableMeta.columns as ColumnType[])

        if (relatedId) {
          await linkRecord(id, relatedId, column, colOptions.type as RelationTypes, { metaValue: relatedTableMeta })
        }
      }
    }
    callbacks?.syncVisibleData?.()
  }

  async function deleteRow(rowIndex: number, undo = false) {
    try {
      const row = cachedRows.value.get(rowIndex)
      if (!row) return

      if (!row.rowMeta.new) {
        const id = meta?.value?.columns
          ?.filter((c) => c.pk)
          .map((c) => row.row[c.title!])
          .join('___')

        const fullRecord = await $api.dbTableRow.read(
          NOCO,
          base?.value.id as string,
          meta.value?.id as string,
          encodeURIComponent(id as string),
          {
            getHiddenColumn: true,
          },
        )

        const deleted = await deleteRowById(id as string)
        if (!deleted) {
          return
        }

        row.row = fullRecord

        if (!undo) {
          addUndo({
            undo: {
              fn: async (row: Row, ltarState: Record<string, any>) => {
                const pkData = rowPkData(row.row, meta?.value?.columns as ColumnType[])

                row.row = { ...pkData, ...row.row }

                await insertRow(row, ltarState, {}, true)

                await recoverLTARRefs(row.row)
              },
              args: [clone(row), {}],
            },
            redo: {
              fn: async (rowIndex: number) => {
                await deleteRow(rowIndex)
              },
              args: [rowIndex],
            },
            scope: defineViewScope({ view: viewMeta.value }),
          })
        }
      }

      cachedRows.value.delete(rowIndex)

      const rows = Array.from(cachedRows.value.entries())
      const rowsToShift = rows.filter(([index]) => index > rowIndex)
      rowsToShift.sort((a, b) => a[0] - b[0])

      for (const [index, row] of rowsToShift) {
        const newIndex = index - 1
        row.rowMeta.rowIndex = newIndex
        cachedRows.value.delete(index)
        cachedRows.value.set(newIndex, row)
      }

      chunkStates.value[getChunkIndex(rowsToShift[rowsToShift.length - 1][0])] = undefined
      totalRows.value = (totalRows.value || 0) - 1

      await syncCount()
      callbacks?.syncVisibleData?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function deleteSelectedRows(): Promise<void> {
    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey: string = ''

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
        limit: 200,
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
      return message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
    }

    const deletedIndexes = removedRowsData.map((row) => row.rowMeta.rowIndex).sort((a, b) => b - a)
    const deletedIndexSet = new Set(deletedIndexes)

    const maxIndex = Math.max(...cachedRows.value.keys())
    const newCachedRows = new Map<number, Row>()
    let newIndex = 0

    for (let i = 0; i <= maxIndex + 1; i++) {
      if (cachedRows.value.has(i) && !deletedIndexSet.has(i)) {
        const row = cachedRows.value.get(i)
        if (row) {
          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
          newIndex++
        }
      }
    }

    chunkStates.value[getChunkIndex(maxIndex)] = undefined

    cachedRows.value = newCachedRows
    totalRows.value = Math.max(0, (totalRows.value || 0) - removedRowsData.length)

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
          await bulkDeleteRows(toBeRemovedData.map((row) => row.pkData))
          const deletedIndexes = toBeRemovedData.map((row) => row.rowMeta.rowIndex).sort((a, b) => b - a)

          const deletedIndexSet = new Set(deletedIndexes)

          const maxIndex = Math.max(...cachedRows.value.keys())
          const newCachedRows = new Map<number, Row>()
          let newIndex = 0

          for (let i = 0; i <= maxIndex + 1; i++) {
            if (cachedRows.value.has(i) && !deletedIndexSet.has(i)) {
              const row = cachedRows.value.get(i)
              if (row) {
                row.rowMeta.rowIndex = newIndex
                newCachedRows.set(newIndex, row)
                newIndex++
              }
            }
          }

          cachedRows.value = newCachedRows
          totalRows.value = Math.max(0, (totalRows.value || 0) - removedRowsData.length)
          chunkStates.value[getChunkIndex(maxIndex)] = undefined
          callbacks?.syncVisibleData?.()
          await syncCount()
        },
        args: [removedRowsData],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    callbacks?.syncVisibleData?.()
    await syncCount()
  }

  async function insertRow(
    currentRow: Row,
    ltarState: Record<string, any> = {},
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
    ignoreShifting = false,
  ): Promise<Record<string, any> | undefined> {
    if (!currentRow.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    currentRow.rowMeta.saving = true

    try {
      const { missingRequiredColumns, insertObj } = await populateInsertObject({
        meta: metaValue!,
        ltarState,
        getMeta,
        row: currentRow.row,
        undo,
      })

      if (missingRequiredColumns.size) {
        return
      }

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        { ...insertObj, ...(ltarState || {}) },
      )

      currentRow.rowMeta.new = false

      Object.assign(currentRow.row, insertedData)

      const insertIndex = currentRow.rowMeta.rowIndex!

      if (cachedRows.value.has(insertIndex) && !ignoreShifting) {
        const rows = Array.from(cachedRows.value.entries())
        const rowsToShift = rows.filter(([index]) => index >= insertIndex)
        rowsToShift.sort((a, b) => b[0] - a[0]) // Sort in descending order

        for (const [index, row] of rowsToShift) {
          row.rowMeta.rowIndex = index + 1
          cachedRows.value.set(index + 1, row)
        }
      }

      if (!undo) {
        Object.assign(currentRow.oldRow, insertedData)

        const id = extractPkFromRow(insertedData, metaValue!.columns as ColumnType[])
        const pkData = rowPkData(insertedData, metaValue?.columns as ColumnType[])

        addUndo({
          undo: {
            fn: async (id: string) => {
              await deleteRowById(id)
              cachedRows.value.delete(insertIndex)

              for (const [index, row] of cachedRows.value) {
                if (index > insertIndex) {
                  row.rowMeta.rowIndex = index - 1
                  cachedRows.value.set(index - 1, row)
                }
              }
              totalRows.value = totalRows.value! - 1
              callbacks?.syncVisibleData?.()
            },
            args: [id],
          },
          redo: {
            fn: async (row: Row, ltarState: Record<string, any>) => {
              row.row = { ...pkData, ...row.row }
              await insertRow(row, ltarState, undefined, true)
            },
            args: [clone(currentRow), clone(ltarState)],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      cachedRows.value.set(insertIndex, currentRow)

      if (!ignoreShifting) {
        totalRows.value++
      }

      await reloadAggregate?.trigger()
      callbacks?.syncVisibleData?.()

      return insertedData
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to insert row: ${errorMessage}`)
      throw error
    } finally {
      currentRow.rowMeta.saving = false
    }
  }

  async function bulkInsertRows(
    rows: Row[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ): Promise<string[]> {
    if (!metaValue || !viewMetaValue) {
      throw new Error('Meta value or view meta value is undefined')
    }

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
      callbacks?.syncVisibleData?.()

      return bulkInsertedIds
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to bulk insert rows: ${errorMessage}`)
      throw error
    }
  }

  async function updateRowProperty(
    toUpdate: Row,
    property: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ): Promise<Record<string, any> | undefined> {
    if (!toUpdate.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    toUpdate.rowMeta.saving = true

    try {
      const id = extractPkFromRow(toUpdate.row, metaValue?.columns as ColumnType[])

      const updatedRowData: Record<string, any> = await $api.dbViewRow.update(
        NOCO,
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        id,
        {
          [property]: toUpdate.row[property] ?? null,
        },
      )

      if (!undo) {
        addUndo({
          undo: {
            fn: async (toUpdate: Row, property: string) => {
              await updateRowProperty(
                { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                property,
                undefined,
                true,
              )
            },
            args: [clone(toUpdate), property],
          },
          redo: {
            fn: async (toUpdate: Row, property: string) => {
              await updateRowProperty(toUpdate, property, undefined, true)
            },
            args: [clone(toUpdate), property],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      // Update specific columns based on their types
      const columnsToUpdate = new Set([
        UITypes.Formula,
        UITypes.QrCode,
        UITypes.Barcode,
        UITypes.Rollup,
        UITypes.Checkbox,
        UITypes.User,
        UITypes.LastModifiedTime,
        UITypes.LastModifiedBy,
        UITypes.Lookup,
        UITypes.Button,
        UITypes.Attachment,
      ])

      metaValue?.columns?.forEach((col: ColumnType) => {
        if (
          col.title &&
          col.title in updatedRowData &&
          (columnsToUpdate.has(col.uidt as UITypes) ||
            col.au ||
            (isValidValue(col?.cdf) && / on update /i.test(col.cdf as string)))
        ) {
          toUpdate.row[col.title] = updatedRowData[col.title]
        }
      })

      Object.assign(toUpdate.oldRow, updatedRowData)

      // Update the row in cachedRows
      if (toUpdate.rowMeta.rowIndex !== undefined) {
        cachedRows.value.set(toUpdate.rowMeta.rowIndex, toUpdate)
      }

      await reloadAggregate?.trigger({ fields: [{ title: property }] })

      callbacks?.syncVisibleData?.()

      if (undo) {
        applySorting(toUpdate)
      }

      return updatedRowData
    } catch (e: any) {
      toUpdate.row[property] = toUpdate.oldRow[property]
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.rowUpdateFailed')}: ${errorMessage}`)
      throw e
    } finally {
      toUpdate.rowMeta.saving = false
    }
  }

  async function updateOrSaveRow(
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ): Promise<void> {
    if (!row.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    row.rowMeta.changed = false

    await until(() => !(row.rowMeta?.new && row.rowMeta?.saving)).toMatch((v) => v)
    let data

    if (row.rowMeta.new) {
      data = await insertRow(row, ltarState, args, false, true)
    } else if (property) {
      data = await updateRowProperty(row, property, args)
    }

    row.rowMeta.isValidationFailed = !validateRowFilters(
      [...allFilters.value, ...computedWhereFilter.value],
      data,
      meta.value?.columns as ColumnType[],
      getBaseType(viewMeta.value?.view.source_id),
    )

    const changedFields = property ? [property] : Object.keys(row.row)

    changedFields.push(
      ...(meta.value
        ?.columns!.filter((c) =>
          [
            UITypes.LastModifiedBy,
            UITypes.LastModifiedTime,
            UITypes.Formula,
            UITypes.Lookup,
            UITypes.Rollup,
            UITypes.LinkToAnotherRecord,
          ].includes(c.uidt as UITypes),
        )
        .map((c) => c.title!) || []),
    )

    if (isSortRelevantChange(changedFields, sorts.value, columnsById.value)) {
      const needsResorting = willSortOrderChange({
        row,
        newData: data,
        sorts: sorts.value,
        columnsById: columnsById.value,
        cachedRows: cachedRows.value,
      })

      const newRow = cachedRows.value.get(row.rowMeta.rowIndex!)
      if (newRow) newRow.rowMeta.isRowOrderUpdated = needsResorting
    }
    callbacks?.syncVisibleData?.()
  }

  async function bulkUpdateRows(
    rows: Row[],
    props: string[],
    { metaValue = meta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ): Promise<void> {
    await Promise.all(
      rows.map(async (row) => {
        if (row.rowMeta) {
          row.rowMeta.changed = false
          await until(() => !(row.rowMeta?.new && row.rowMeta?.saving)).toMatch((v) => v)
          row.rowMeta.saving = true
        }
      }),
    )

    const updateArray = rows.map((row) => {
      const pk = rowPkData(row.row, metaValue?.columns as ColumnType[])
      const updateData = props.reduce((acc, prop) => ({ ...acc, [prop]: row.row[prop] }), {})
      return { ...updateData, ...pk }
    })

    try {
      await $api.dbTableRow.bulkUpdate(NOCO, metaValue?.base_id as string, metaValue?.id as string, updateArray)
      await reloadAggregate?.trigger({ fields: props.map((p) => ({ title: p })) })

      // Update cachedRows with the updated data
      rows.forEach((row) => {
        if (row.rowMeta.rowIndex !== undefined) {
          cachedRows.value.set(row.rowMeta.rowIndex, row)
        }
      })
    } finally {
      rows.forEach((row) => {
        if (row.rowMeta) row.rowMeta.saving = false
      })
    }

    callbacks?.syncVisibleData?.()

    if (!undo) {
      addUndo({
        undo: {
          fn: async (undoRows: Row[], props: string[]) => {
            await bulkUpdateRows(undoRows, props, undefined, true)
          },
          args: [clone(rows.map((row) => ({ row: row.oldRow, oldRow: row.row, rowMeta: row.rowMeta }))), props],
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
  }

  async function bulkUpdateView(
    data: Record<string, any>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ): Promise<void> {
    if (!viewMetaValue) {
      throw new Error('View meta value is missing')
    }

    await $api.dbTableRow.bulkUpdateAll(NOCO, metaValue?.base_id as string, metaValue?.id as string, data, {
      viewId: viewMetaValue.id,
    })

    await reloadAggregate?.trigger()
    callbacks?.syncVisibleData?.()
  }

  async function deleteRowById(
    id: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ): Promise<boolean> {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    try {
      const res: any = await $api.dbViewRow.delete(
        'noco',
        base.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        encodeURIComponent(id),
      )

      await reloadAggregate?.trigger()

      if (res.message) {
        const errorMessage = `Unable to delete record with ID ${id} because of the following:\n${res.message.join(
          '\n',
        )}.\nClear the data first & try again`
        message.info(`Record delete failed: ${errorMessage}`)
        return false
      }

      return true
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      return false
    }
  }

  const fetchMissingChunks = async (startIndex: number, endIndex: number) => {
    const firstChunkId = getChunkIndex(startIndex)
    const lastChunkId = getChunkIndex(endIndex)

    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !chunkStates.value[chunkId],
    )

    await Promise.all(chunksToFetch.map(fetchChunk))
  }

  async function updateCacheAfterDelete(rowsToDelete: Record<string, any>[]): Promise<void> {
    const maxCachedIndex = Math.max(...cachedRows.value.keys())
    const newCachedRows = new Map<number, Row>()
    let newIndex = 0

    for (let i = 0; i <= maxCachedIndex + 1; i++) {
      if (!rowsToDelete.some((row) => row.rowIndex === i) && cachedRows.value.has(i)) {
        const row = cachedRows.value.get(i)
        if (row) {
          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
          newIndex++
        }
      }
    }

    cachedRows.value = newCachedRows
    totalRows.value = Math.max(0, totalRows.value - rowsToDelete.length)

    chunkStates.value[getChunkIndex(maxCachedIndex)] = undefined

    await syncCount()
    callbacks?.syncVisibleData?.()
  }

  async function deleteRangeOfRows(cellRange: CellRange): Promise<void> {
    if (!cellRange._start || !cellRange._end) return

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
      limit: 200,
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
  }

  async function bulkDeleteRows(
    rows: Record<string, string>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ): Promise<any> {
    try {
      const bulkDeletedRowsData = await $api.dbDataTableRow.delete(metaValue?.id as string, rows.length === 1 ? rows[0] : rows, {
        viewId: viewMetaValue?.id as string,
      })
      await reloadAggregate?.trigger()

      return rows.length === 1 && bulkDeletedRowsData ? [bulkDeletedRowsData] : bulkDeletedRowsData
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Bulk delete failed: ${errorMessage}`)
    }
  }

  const removeRowIfNew = (row: Row): boolean => {
    const index = Array.from(cachedRows.value.entries()).find(([_, r]) => r.rowMeta.rowIndex === row.rowMeta.rowIndex)?.[0]

    if (index !== undefined && row.rowMeta.new) {
      cachedRows.value.delete(index)
      return true
    }
    return false
  }

  async function syncCount(): Promise<void> {
    try {
      const { count } = isPublic.value
        ? await fetchCount({
            filtersArr: nestedFilters.value,
            where: where?.value,
          })
        : await $api.dbViewRow.count(NOCO, base?.value?.id as string, meta.value!.id as string, viewMeta?.value?.id as string, {
            where: where?.value,
          })

      totalRows.value = count as number
      callbacks?.syncVisibleData?.()
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to sync count: ${errorMessage}`)
      throw error
    }
  }

  return {
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
    removeRowIfNew,
    bulkDeleteRows,
    bulkInsertRows,
    cachedRows,
    totalRows,
    clearCache,
    syncCount,
    selectedRows,
    chunkStates,
    isRowSortRequiredRows,
    clearInvalidRows,
    applySorting,
  }
}

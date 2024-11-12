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
} from 'nocodb-sdk'
import type { Row } from '../lib/types'
import { validateRowFilters } from '../utils/dataUtils'

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

    for (let chunk = 0; chunk <= Math.max(...Array.from(cachedRows.value.keys()).map(getChunkIndex)); chunk++) {
      const isVisibleChunk = chunk >= safeStartChunk && chunk <= safeEndChunk
      const chunkStart = chunk * CHUNK_SIZE
      const chunkEnd = chunkStart + CHUNK_SIZE

      const hasImportantRows = Array.from(cachedRows.value)
        .filter(([index]) => index >= chunkStart && index < chunkEnd)
        .some(([_, row]) => row.rowMeta.selected || row.rowMeta.new)

      if (isVisibleChunk || hasImportantRows) {
        for (let i = chunkStart; i < chunkEnd; i++) {
          const row = cachedRows.value.get(i)
          if (row) newCachedRows.set(i, row)
        }
      }
    }

    cachedRows.value = newCachedRows
    chunkStates.value = chunkStates.value.map((state, chunk) =>
      chunk >= safeStartChunk && chunk <= safeEndChunk ? state : undefined,
    )
  }

  const fetchMissingChunks = async (startIndex: number, endIndex: number) => {
    const firstChunkId = Math.floor(startIndex / CHUNK_SIZE)
    const lastChunkId = Math.floor(endIndex / CHUNK_SIZE)

    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !chunkStates.value[chunkId],
    )

    await Promise.all(chunksToFetch.map(fetchChunk))
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

    for (const [oldIndex, row] of sortedEntries) {
      if (!invalidIndexes.includes(oldIndex)) {
        const newIndex = oldIndex - invalidIndexes.filter((i) => i < oldIndex).length
        newCachedRows.set(newIndex, row)
      }
    }

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
          pk: extractPkFromRow(row.row, meta.value?.columns ?? []),
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

      const entry = sortedRangeEntries.find((e) => e.pk === extractPkFromRow(inputRow.row, meta.value?.columns ?? []))
      if (!entry) return

      const targetIndex = sourceRange.start + sortedRangeEntries.indexOf(entry)

      const newCachedRows = new Map(cachedRows.value)

      if (targetIndex !== originalIndex) {
        if (targetIndex < originalIndex) {
          for (let i = originalIndex - 1; i >= targetIndex; i--) {
            const row = newCachedRows.get(i)
            if (row) {
              row.rowMeta.rowIndex = i + 1
              row.rowMeta.isRowOrderUpdated = false
              newCachedRows.set(i + 1, row)
            }
          }
        } else {
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

        const targetChunkIndex = getChunkIndex(targetIndex)

        if (targetIndex <= sourceRange.start || targetIndex >= sourceRange.end) {
          if (targetIndex <= sourceRange.start) {
            for (let i = 0; i <= targetChunkIndex; i++) {
              chunkStates.value[i] = undefined
            }
          } else if (targetIndex >= sourceRange.end) {
            for (let i = targetChunkIndex; i <= getChunkIndex(totalRows.value - 1); i++) {
              chunkStates.value[i] = undefined
            }
          }
        }
      }

      cachedRows.value = newCachedRows
    })

    callbacks?.syncVisibleData?.()
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

      if (rowsToShift.length) {
        chunkStates.value[getChunkIndex(rowsToShift[rowsToShift.length - 1][0])] = undefined
      }

      totalRows.value = (totalRows.value || 0) - 1

      await syncCount()
      callbacks?.syncVisibleData?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
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

      if (!undo) {
        Object.assign(currentRow.oldRow, insertedData)

        const id = extractPkFromRow(insertedData, metaValue!.columns as ColumnType[])
        const pkData = rowPkData(insertedData, metaValue?.columns as ColumnType[])

        addUndo({
          undo: {
            fn: async (
              id: string,
              tempLocalCache: Map<number, Row>,
              tempTotalRows: number,
              tempChunkStates: Array<'loading' | 'loaded' | undefined>,
            ) => {
              cachedRows.value = new Map(tempLocalCache)
              totalRows.value = tempTotalRows
              chunkStates.value = tempChunkStates

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
            args: [id, clone(new Map(cachedRows.value)), clone(totalRows.value), clone(chunkStates.value)],
          },
          redo: {
            fn: async (
              row: Row,
              ltarState: Record<string, any>,
              tempLocalCache: Map<number, Row>,
              tempTotalRows: number,
              tempChunkStates: Array<'loading' | 'loaded' | undefined>,
            ) => {
              cachedRows.value = new Map(tempLocalCache)
              totalRows.value = tempTotalRows
              chunkStates.value = tempChunkStates

              row.row = { ...pkData, ...row.row }
              const newData = await insertRow(row, ltarState, undefined, true)

              const needsResorting = willSortOrderChange({
                row,
                newData,
                sorts: sorts.value,
                columnsById: columnsById.value,
                cachedRows: cachedRows.value,
              })

              if (needsResorting) {
                const newRow = cachedRows.value.get(row.rowMeta.rowIndex!)
                if (newRow) newRow.rowMeta.isRowOrderUpdated = needsResorting
              }

              callbacks?.syncVisibleData?.()
            },
            args: [
              clone(currentRow),
              clone(ltarState),
              clone(new Map(cachedRows.value)),
              clone(totalRows.value),
              clone(chunkStates.value),
            ],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      if (cachedRows.value.has(insertIndex) && !ignoreShifting) {
        const rows = Array.from(cachedRows.value.entries())
        const rowsToShift = rows.filter(([index]) => index >= insertIndex)
        rowsToShift.sort((a, b) => b[0] - a[0]) // Sort in descending order

        for (const [index, row] of rowsToShift) {
          row.rowMeta.rowIndex = index + 1
          cachedRows.value.set(index + 1, row)
        }
      }

      cachedRows.value.set(insertIndex, currentRow)

      if (!ignoreShifting) {
        totalRows.value++
      }

      reloadAggregate?.trigger()
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
            fn: async (toUpdate: Row, property: string, previousCache: Map<number, Row>, tempTotalRows: number) => {
              cachedRows.value = new Map(previousCache)
              totalRows.value = tempTotalRows

              await updateRowProperty(
                { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                property,
                undefined,
                true,
              )
            },
            args: [clone(toUpdate), property, clone(new Map(cachedRows.value)), clone(totalRows.value)],
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

      reloadAggregate?.trigger({ fields: [{ title: property }] })

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
      getBaseType(viewMeta.value?.view?.source_id),
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

    reloadAggregate?.trigger()
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

      reloadAggregate?.trigger()

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
    getChunkIndex,
    fetchMissingChunks,
    fetchChunk,
    updateOrSaveRow,
    bulkUpdateView,
    removeRowIfNew,
    cachedRows,
    recoverLTARRefs,
    totalRows,
    clearCache,
    syncCount,
    selectedRows,
    chunkStates,
    isRowSortRequiredRows,
    clearInvalidRows,
    applySorting,
    CHUNK_SIZE,
  }
}

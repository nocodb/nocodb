import type { ComputedRef, Ref } from 'vue'
import {
  type ColumnType,
  type LinkToAnotherRecordType,
  type RelationTypes,
  type TableType,
  UITypes,
  type ViewType,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
} from 'nocodb-sdk'
import type { Row } from '../lib/types'
import type { CellRange } from './useMultiSelect/cellRange'

export function useInfiniteData(args: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>
  callbacks: {
    loadData?: () => Promise<Row[] | undefined>
    syncCount?: () => Promise<void>
    syncVisibleData?: () => void
  }
}) {
  const { meta, viewMeta, callbacks } = args

  const { t } = useI18n()

  const NOCO = 'noco'

  const { getMeta, metas } = useMetas()

  const { base } = storeToRefs(useBase())

  const { $api } = useNuxtApp()

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const cachedRows = ref<Map<number, Row>>(new Map())

  const totalRows = ref(1000)

  const BUFFER_SIZE = 100

  const MAX_CACHE_SIZE = 200

  const CHUNK_SIZE = 50

  const chunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])

  const syncRowIndex = (indices: number | number[], operation: 'create' | 'delete') => {
    const indexSet = new Set(Array.isArray(indices) ? indices : [indices])
    const newCachedRows = new Map<number, Row>()

    const shift = operation === 'delete' ? -1 : 1

    for (const [oldIndex, row] of cachedRows.value) {
      if (operation === 'delete' && indexSet.has(oldIndex)) {
        continue // Skip deleted rows
      }

      let newIndex = oldIndex
      indexSet.forEach((targetIndex) => {
        if ((operation === 'delete' && oldIndex > targetIndex) || (operation === 'create' && oldIndex >= targetIndex)) {
          newIndex += shift
        }
      })

      newCachedRows.set(newIndex, {
        ...row,
        rowMeta: { ...row.rowMeta, rowIndex: newIndex },
      })
    }

    // Handle newly created rows
    if (operation === 'create') {
      indexSet.forEach((createIndex) => {
        if (!newCachedRows.has(createIndex)) {
          newCachedRows.set(createIndex, {
            row: {},
            oldRow: {},
            rowMeta: { rowIndex: createIndex, isLoading: true },
          })
        }
      })
    }

    cachedRows.value = newCachedRows

    // Update chunk states
    const minAffectedChunk = Math.floor(Math.min(...newCachedRows.keys()) / CHUNK_SIZE)
    const maxAffectedChunk = Math.floor(Math.max(...newCachedRows.keys()) / CHUNK_SIZE)

    for (let i = minAffectedChunk; i <= maxAffectedChunk; i++) {
      const chunkStart = i * CHUNK_SIZE
      const chunkEnd = (i + 1) * CHUNK_SIZE
      const hasRowsInChunk = Array.from(newCachedRows.keys()).some((index) => index >= chunkStart && index < chunkEnd)
      chunkStates.value[i] = hasRowsInChunk ? 'loaded' : undefined
    }
  }

  const clearCache = (visibleStartIndex: number, visibleEndIndex: number) => {
    if (visibleEndIndex === Number.POSITIVE_INFINITY && visibleStartIndex === Number.NEGATIVE_INFINITY) {
      cachedRows.value.clear()
      chunkStates.value = []
      return
    }

    if (cachedRows.value.size <= MAX_CACHE_SIZE) return

    const safeStartIndex = Math.max(0, visibleStartIndex - BUFFER_SIZE)
    const safeEndIndex = Math.min(totalRows.value - 1, visibleEndIndex + BUFFER_SIZE)
    const safeStartChunk = Math.floor(safeStartIndex / CHUNK_SIZE)
    const safeEndChunk = Math.floor(safeEndIndex / CHUNK_SIZE)

    const newCachedRows = new Map<number, Row>()
    let keptCount = 0

    for (const [index, row] of cachedRows.value) {
      const chunk = Math.floor(index / CHUNK_SIZE)
      if (
        (chunk >= safeStartChunk && chunk <= safeEndChunk) ||
        row.rowMeta.selected ||
        row.rowMeta.new ||
        keptCount < MAX_CACHE_SIZE
      ) {
        newCachedRows.set(index, row)
        keptCount++
      }
    }

    cachedRows.value = newCachedRows

    // Update chunk states
    chunkStates.value = chunkStates.value.map((state, chunkId) =>
      chunkId >= safeStartChunk && chunkId <= safeEndChunk ? state : undefined,
    )

    callbacks?.syncVisibleData?.()
  }

  const selectedRows = computed<Row[]>(() => {
    return Array.from(cachedRows.value.values()).filter((row) => row.rowMeta?.selected)
  })

  function addEmptyRow(addAfter = totalRows.value, metaValue = meta.value) {
    const newIndex = addAfter + 1
    const newRow = {
      row: { ...rowDefaultData(metaValue?.columns) },
      oldRow: {},
      rowMeta: { new: true, rowIndex: newIndex },
    }
    cachedRows.value.set(newIndex, newRow)

    callbacks?.syncVisibleData?.()

    return newRow
  }

  async function deleteRow(rowIndex: number) {
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
      }

      cachedRows.value.delete(rowIndex)
      syncRowIndex(rowIndex, 'delete')
      totalRows.value = (totalRows.value || 0) - 1

      await callbacks?.syncCount?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    callbacks?.syncVisibleData?.()
  }

  async function deleteSelectedRows(): Promise<void> {
    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey: string = ''

    for (const [index, row] of cachedRows.value) {
      const { row: rowData, rowMeta } = row

      if (!rowMeta.selected || rowMeta.new) {
        continue
      }

      const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
      compositePrimaryKey = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[]) as string
      const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

      if (extractedPk && compositePrimaryKey) {
        removedRowsData.push({
          [extractedPk]: compositePrimaryKey,
          pkData,
          row: { ...rowData },
          rowIndex: index,
        })
      }
    }

    if (!removedRowsData.length) return

    try {
      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))

      // Remove deleted rows and update indexes
      const deletedIndexes = removedRowsData.map((row) => row.rowIndex).sort((a, b) => b - a)
      for (const index of deletedIndexes) {
        cachedRows.value.delete(index)
        syncRowIndex(index, 'delete')
      }

      totalRows.value = Math.max(0, (totalRows.value || 0) - removedRowsData.length)

      callbacks?.syncVisibleData?.()
      await callbacks?.syncCount?.()
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      throw e
    }
  }

  async function insertRow(
    currentRow: Row,
    ltarState: Record<string, any> = {},
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
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
      })

      if (missingRequiredColumns.size) {
        throw new Error(`Missing required columns: ${Array.from(missingRequiredColumns).join(', ')}`)
      }

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        { ...insertObj, ...ltarState },
      )

      // Update the current row with the inserted data
      Object.assign(currentRow.row, insertedData)
      currentRow.rowMeta.new = false

      // Find the appropriate index for the new row
      const insertIndex = currentRow.rowMeta.rowIndex!

      // Insert the new row into cachedRows
      cachedRows.value.set(insertIndex, currentRow)

      // Update row indices
      syncRowIndex(insertIndex, 'create')

      await reloadAggregate?.trigger()
      await callbacks?.syncCount?.()
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
          })

          if (missingRequiredColumns.size === 0) {
            for (const key of autoGeneratedKeys) {
              delete insertObj[key!]
            }
            return insertObj
          }
          return null
        }),
      )

      const validRowsToInsert = rowsToInsert.filter((row): row is Record<string, any> => row !== null)

      const bulkInsertedIds = await $api.dbDataTableRow.create(metaValue.id!, validRowsToInsert, {
        viewId: viewMetaValue.id,
      })

      // Update cachedRows with the new rows
      const startIndex = totalRows.value
      validRowsToInsert.forEach((insertedRow, index) => {
        const newRowIndex = startIndex + index
        cachedRows.value.set(newRowIndex, {
          row: insertedRow,
          oldRow: {},
          rowMeta: { rowIndex: newRowIndex, new: false },
        })
      })

      totalRows.value += validRowsToInsert.length

      // Update row indices
      syncRowIndex(startIndex, 'create')

      await callbacks?.syncCount?.()
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

    if (row.rowMeta.new) {
      await insertRow(row, ltarState, args)
    } else if (property) {
      await updateRowProperty(row, property, args)
    }

    callbacks?.syncVisibleData?.()
  }

  async function bulkUpdateRows(
    rows: Row[],
    props: string[],
    { metaValue = meta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
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

      // Remove the deleted row from cachedRows
      const deletedRowIndex = Array.from(cachedRows.value.entries()).find(
        ([_, row]) => extractPkFromRow(row.row, metaValue?.columns as ColumnType[]) === id,
      )?.[0]

      if (deletedRowIndex !== undefined) {
        cachedRows.value.delete(deletedRowIndex)
        syncRowIndex(deletedRowIndex, 'delete')
        totalRows.value = Math.max(0, (totalRows.value || 0) - 1)
      }

      callbacks?.syncVisibleData?.()
      return true
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      throw error
    }
  }

  async function deleteRangeOfRows(cellRange: CellRange): Promise<void> {
    if (!cellRange._start || !cellRange._end) return

    const start = Math.min(cellRange._start.row, cellRange._end.row)
    const end = Math.max(cellRange._start.row, cellRange._end.row)

    const rowsToDelete: Record<string, any>[] = []
    let compositePrimaryKey = ''

    for (let i = start; i <= end; i++) {
      const cachedRow = cachedRows.value.get(i)
      if (!cachedRow) continue

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

    try {
      await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))

      // Remove rows in reverse order to avoid index shifting issues
      for (let i = rowsToDelete.length - 1; i >= 0; i--) {
        const { rowIndex } = rowsToDelete[i]
        cachedRows.value.delete(rowIndex)
        syncRowIndex(rowIndex, 'delete')
      }

      totalRows.value = Math.max(0, totalRows.value - rowsToDelete.length)

      await callbacks?.syncCount?.()
      callbacks?.syncVisibleData?.()
    } catch (e: any) {
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      throw e
    }
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
      syncRowIndex(index, 'delete')
      return true
    }
    return false
  }

  async function syncCount(): Promise<void> {
    try {
      const { count } = await $api.dbViewRow.count(
        NOCO,
        base?.value?.id as string,
        meta.value!.id as string,
        viewMeta?.value?.id as string,
      )

      totalRows.value = count === 0 ? Infinity : (count as number)
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
    syncRowIndex,
    chunkStates,
  }
}

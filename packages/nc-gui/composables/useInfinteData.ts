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
import type { Row, UndoRedoAction } from '../lib/types'
import type { CellRange } from './useMultiSelect/cellRange'

export function useInfiniteData(args: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>
  callbacks: {
    loadData?: () => Promise<void>
    syncCount?: () => Promise<void>
    syncVisibleData?: () => void
  }
}) {
  const { meta, viewMeta, callbacks } = args

  const { t } = useI18n()

  const { getMeta, metas } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const { base } = storeToRefs(useBase())

  const { $api } = useNuxtApp()

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const cachedLocalRows = ref<Record<number, Row>>({})

  const totalRows = ref(1000)

  const bufferSize = 100

  const maxCacheSize = 500

  const CHUNK_SIZE = 50

  const chunkStates = new Map<number, 'loading' | 'loaded'>()

  const syncRowIndex = (indices: number | number[], operation: 'create' | 'delete') => {
    const indexSet = new Set(Array.isArray(indices) ? indices : [indices])
    const newCachedLocalRows = {} as Record<number, Row>

    const compareIndex =
      operation === 'delete'
        ? (oldIndex: number, targetIndex: number) => oldIndex > targetIndex
        : (oldIndex: number, targetIndex: number) => oldIndex >= targetIndex

    let maxAffectedChunk = -1
    let minAffectedChunk = Infinity

    for (const [index, row] of Object.entries(cachedLocalRows.value)) {
      const oldIndex = Number(index)
      let newIndex = oldIndex

      if (operation === 'delete' && indexSet.has(oldIndex)) {
        continue // Skip deleted rows
      }

      indexSet.forEach((targetIndex) => {
        if (compareIndex(oldIndex, targetIndex)) {
          newIndex += operation === 'delete' ? -1 : 1
        }
      })

      newCachedLocalRows[newIndex] = {
        ...row,
        rowMeta: { ...row.rowMeta, rowIndex: newIndex },
      }

      const affectedChunk = Math.floor(newIndex / CHUNK_SIZE)
      maxAffectedChunk = Math.max(maxAffectedChunk, affectedChunk)
      minAffectedChunk = Math.min(minAffectedChunk, affectedChunk)
    }

    // Handle newly created rows
    if (operation === 'create') {
      indexSet.forEach((createIndex) => {
        if (!(createIndex in newCachedLocalRows)) {
          newCachedLocalRows[createIndex] = {
            row: {},
            oldRow: {},
            rowMeta: { rowIndex: createIndex, isLoading: true },
          }
          const affectedChunk = Math.floor(createIndex / CHUNK_SIZE)
          maxAffectedChunk = Math.max(maxAffectedChunk, affectedChunk)
          minAffectedChunk = Math.min(minAffectedChunk, affectedChunk)
        }
      })
    }

    cachedLocalRows.value = newCachedLocalRows

    for (let i = minAffectedChunk; i <= maxAffectedChunk; i++) {
      const chunkStart = i * CHUNK_SIZE
      const chunkEnd = (i + 1) * CHUNK_SIZE
      const hasRowsInChunk = Object.keys(newCachedLocalRows).some(
        (key) => parseInt(key) >= chunkStart && parseInt(key) < chunkEnd,
      )
      if (hasRowsInChunk) {
        chunkStates.set(i, 'loaded')
      } else {
        chunkStates.delete(i)
      }
    }
  }

  const clearCache = (visibleStartIndex: number, visibleEndIndex: number) => {
    if (visibleEndIndex === Number.POSITIVE_INFINITY && visibleStartIndex === Number.NEGATIVE_INFINITY) {
      cachedLocalRows.value = {}
      chunkStates.clear()
      return
    }

    const cacheSize = Object.keys(cachedLocalRows.value).length
    if (cacheSize <= maxCacheSize) return

    const safeStartIndex = Math.max(0, visibleStartIndex - bufferSize)
    const safeEndIndex = Math.min(totalRows.value - 1, visibleEndIndex + bufferSize)
    const safeStartChunk = Math.floor(safeStartIndex / CHUNK_SIZE)
    const safeEndChunk = Math.floor(safeEndIndex / CHUNK_SIZE)

    const chunksToKeep = new Set()
    for (let i = safeStartChunk; i <= safeEndChunk; i++) {
      chunksToKeep.add(i)
    }

    const rowsToKeep = new Set()
    Object.keys(cachedLocalRows.value).forEach((key) => {
      const index = Number(key)
      const chunk = Math.floor(index / CHUNK_SIZE)
      const row = cachedLocalRows.value[index]
      if (chunksToKeep.has(chunk) || row.rowMeta.selected || row.rowMeta.new) {
        rowsToKeep.add(index)
      }
    })

    const newCachedLocalRows: Record<number, Row> = {}
    let removedCount = 0

    Object.keys(cachedLocalRows.value).forEach((key) => {
      const index = Number(key)
      if (rowsToKeep.has(index)) {
        newCachedLocalRows[index] = cachedLocalRows.value[index]
      } else {
        removedCount++
        if (removedCount > cacheSize - maxCacheSize) {
          newCachedLocalRows[index] = cachedLocalRows.value[index]
        }
      }
    })

    cachedLocalRows.value = newCachedLocalRows

    // Update chunk states
    chunkStates.forEach((state, chunkId) => {
      if (
        !chunksToKeep.has(chunkId) &&
        !Object.keys(newCachedLocalRows).some((key) => Math.floor(Number(key) / CHUNK_SIZE) === chunkId)
      ) {
        chunkStates.delete(chunkId)
      }
    })

    callbacks?.syncVisibleData?.()
  }

  const selectedRows = computed<Row[]>(() => {
    return Object.values(cachedLocalRows).filter((row) => row.rowMeta?.selected)
  })

  function addEmptyRow(addAfter = totalRows.value, metaValue = meta.value) {
    const newIndex = addAfter + 1
    cachedLocalRows.value[newIndex] = {
      row: { ...rowDefaultData(metaValue?.columns) },
      oldRow: {},
      rowMeta: { new: true, rowIndex: newIndex },
    }

    callbacks?.syncVisibleData?.()

    return cachedLocalRows.value[newIndex]
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
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        { ...insertObj, ...(ltarState || {}) },
      )

      await reloadAggregate?.trigger()

      const newVirtualIndex = totalRows.value

      if (!undo) {
        Object.assign(currentRow, {
          row: { ...insertedData, ...row },
          rowMeta: { ...(currentRow.rowMeta || {}), new: undefined, rowIndex: newVirtualIndex },
          oldRow: { ...insertedData },
        })

        const id = extractPkFromRow(insertedData, metaValue?.columns as ColumnType[])

        // Update cachedLocalRows
        cachedLocalRows.value[newVirtualIndex] = currentRow

        // Update paginationData
        totalRows.value = (totalRows.value || 0) + 1

        addUndo({
          redo: {
            fn: async function redo(this: UndoRedoAction, row: Row, ltarState: Record<string, any>) {
              await insertRow(row, ltarState, undefined, true)
            },
            args: [clone(currentRow), clone(ltarState)],
          },
          undo: {
            fn: async function undo(this: UndoRedoAction, id: string, virtualIndex: number) {
              await deleteRowById(id)
              delete cachedLocalRows.value[virtualIndex]
              totalRows.value = (totalRows.value || 0) - 1
            },
            args: [id, newVirtualIndex],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      await callbacks?.syncCount?.()
      callbacks?.syncVisibleData?.()
      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
      callbacks?.syncVisibleData?.()
    } finally {
      if (currentRow.rowMeta) currentRow.rowMeta.saving = false
    }
  }

  async function bulkInsertRows(
    rows: Row[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    const autoGeneratedKeys = clone(metaValue?.columns || [])
      .filter((c) => !c.pk && (isCreatedOrLastModifiedTimeCol(c) || isCreatedOrLastModifiedByCol(c)))
      .map((c) => c.title)

    try {
      const rowsToInsert =
        (
          await Promise.all(
            rows.map(async (currentRow) => {
              const { missingRequiredColumns, insertObj } = await populateInsertObject({
                meta: metaValue!,
                ltarState: {},
                getMeta,
                row: currentRow.row,
                undo,
              })

              if (missingRequiredColumns.size === 0) {
                autoGeneratedKeys.forEach((key) => delete insertObj[key!])
                return insertObj
              }
            }),
          )
        )?.filter(Boolean) ?? []

      const bulkInsertedIds = (await $api.dbDataTableRow.create(metaValue?.id as string, rowsToInsert, {
        viewId: viewMetaValue?.id as string,
      })) as string[]

      if (!undo) {
        bulkInsertedIds.forEach((id, index) => {
          const newIndex = totalRows.value + index
          cachedLocalRows.value[newIndex] = {
            row: { ...rows[index].row, id },
            oldRow: { ...rows[index].row, id },
            rowMeta: { rowIndex: newIndex },
          }
        })
      }

      await callbacks?.syncCount?.()
      callbacks?.syncVisibleData?.()

      return bulkInsertedIds
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  async function updateRowProperty(
    toUpdate: Row,
    property: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    if (toUpdate.rowMeta) toUpdate.rowMeta.saving = true

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
      await reloadAggregate?.trigger({ fields: [{ title: property }] })

      if (!undo) {
        addUndo({
          undo: {
            fn: async function undo(toUpdate: Row, property: string) {
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
            fn: async function redo(toUpdate: Row, property: string) {
              await updateRowProperty(toUpdate, property, undefined, true)
            },
            args: [clone(toUpdate), property],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })

        /** update row data(to sync formula and other related columns)
         * update only formula, rollup and auto updated datetime columns data to avoid overwriting any changes made by user
         * update attachment as well since id is required for further operations
         */
        Object.assign(
          toUpdate.row,
          metaValue!.columns!.reduce<Record<string, any>>((acc: Record<string, any>, col: ColumnType) => {
            if (
              col.title! in updatedRowData &&
              (col.uidt === UITypes.Formula ||
                col.uidt === UITypes.QrCode ||
                col.uidt === UITypes.Barcode ||
                col.uidt === UITypes.Rollup ||
                col.uidt === UITypes.Checkbox ||
                col.uidt === UITypes.User ||
                col.uidt === UITypes.LastModifiedTime ||
                col.uidt === UITypes.LastModifiedBy ||
                col.uidt === UITypes.Lookup ||
                col.uidt === UITypes.Button ||
                col.uidt === UITypes.Attachment ||
                col.au ||
                (isValidValue(col?.cdf) && / on update /i.test(col.cdf as any)))
            )
              acc[col.title!] = updatedRowData[col.title!]
            return acc
          }, {} as Record<string, any>),
        )
        Object.assign(toUpdate.oldRow, updatedRowData)
      }

      cachedLocalRows.value[toUpdate.rowMeta.rowIndex!] = toUpdate

      callbacks?.syncVisibleData?.()

      return updatedRowData
    } catch (e: any) {
      toUpdate.row[property] = toUpdate.oldRow[property]
      message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
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
    callbacks?.syncVisibleData?.()
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

    await $api.dbTableRow.bulkUpdate(NOCO, metaValue?.base_id as string, metaValue?.id as string, updateArray)
    await reloadAggregate?.trigger({ fields: props.map((p) => ({ title: p })) })

    if (!undo) {
      addUndo({
        redo: {
          fn: async function redo(redoRows: Row[], props: string[]) {
            await bulkUpdateRows(redoRows, props, { metaValue, viewMetaValue }, true)
            for (const toUpdate of redoRows) {
              const rowIndex = toUpdate.rowMeta.rowIndex!
              if (rowIndex in cachedLocalRows.value) {
                Object.assign(cachedLocalRows.value[rowIndex].row, toUpdate.row)
                Object.assign(cachedLocalRows.value[rowIndex].oldRow, toUpdate.row)
              }
            }
          },
          args: [clone(rows), clone(props)],
        },
        undo: {
          fn: async function undo(undoRows: Row[], props: string[]) {
            await bulkUpdateRows(undoRows, props, { metaValue, viewMetaValue }, true)
            for (const toUpdate of undoRows) {
              const rowIndex = toUpdate.rowMeta.rowIndex!
              if (rowIndex in cachedLocalRows.value) {
                Object.assign(cachedLocalRows.value[rowIndex].row, toUpdate.row)
                Object.assign(cachedLocalRows.value[rowIndex].oldRow, toUpdate.row)
              }
            }
          },
          args: [
            clone(
              rows.map((row) => {
                return { row: row.oldRow, oldRow: row.row, rowMeta: row.rowMeta }
              }),
            ),
            props,
          ],
        },
        scope: defineViewScope({ view: viewMetaValue }),
      })
    }

    for (const row of rows) {
      if (row.rowMeta) row.rowMeta.saving = false
    }
    callbacks?.syncVisibleData?.()
  }

  async function bulkUpdateView(
    data: Record<string, any>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    if (!viewMetaValue) return

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
  ) => {
    try {
      await $api.dbTableRow.nestedAdd(
        NOCO,
        base.value.id as string,
        metaValue?.id as string,
        encodeURIComponent(rowId),
        type as RelationTypes,
        column.title as string,
        encodeURIComponent(relatedRowId),
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
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
  ) {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    const res: any = await $api.dbViewRow.delete(
      'noco',
      base.value.id as string,
      metaValue?.id as string,
      viewMetaValue?.id as string,
      encodeURIComponent(id),
    )

    await reloadAggregate?.trigger()

    if (res.message) {
      message.info(
        `Record delete failed: ${`Unable to delete record with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
      )
      return false
    }
    callbacks?.syncVisibleData?.()

    return true
  }

  async function deleteRow(rowIndex: number, undo?: boolean) {
    try {
      const row = cachedLocalRows.value[rowIndex]
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
            redo: {
              fn: async function redo(this: UndoRedoAction, id: string) {
                await deleteRowById(id)
                delete cachedLocalRows.value[rowIndex]
                syncRowIndex(rowIndex, 'delete')
                totalRows.value = (totalRows.value || 0) - 1
              },
              args: [id],
            },
            undo: {
              fn: async function undo(this: UndoRedoAction, row: Row, ltarState: Record<string, any>) {
                const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
                row.row = { ...pkData, ...row.row }
                await insertRow(row, ltarState, {}, true)
                await recoverLTARRefs(row.row)
                cachedLocalRows.value[rowIndex] = row
                syncRowIndex(rowIndex, 'create')
                totalRows.value = (totalRows.value || 0) + 1
              },
              args: [clone(row), {}],
            },
            scope: defineViewScope({ view: viewMeta.value }),
          })
        }
      }

      delete cachedLocalRows.value[rowIndex]
      syncRowIndex(rowIndex, 'delete')
      totalRows.value = (totalRows.value || 0) - 1

      await callbacks?.syncCount?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    callbacks?.syncVisibleData?.()
  }

  async function deleteSelectedRows() {
    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey: string = ''

    Object.entries(cachedLocalRows.value).forEach(([index, row]) => {
      const { row: rowData, rowMeta } = row

      if (!rowMeta.selected) {
        return
      }

      if (!rowMeta.new) {
        const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
        compositePrimaryKey = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[]) as string
        const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

        if (extractedPk && compositePrimaryKey) {
          removedRowsData.push({
            [extractedPk]: compositePrimaryKey as string,
            pkData,
            row: clone(rowData) as Row,
            rowIndex: index,
          })
        }
      }
    })

    if (!removedRowsData.length) return

    const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
      pks: removedRowsData.map((row) => row[compositePrimaryKey]).join(','),
    })

    try {
      for (const removedRow of removedRowsData) {
        const rowObj = removedRow.row
        const rowPk = rowPkData(rowObj.row, meta?.value?.columns as ColumnType[])
        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => rowPk[key] === r[key])
        })
        rowObj.row = clone(fullRecord)
      }

      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))
    } catch (e: any) {
      return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }

    addUndo({
      undo: {
        fn: async function undo(this: UndoRedoAction, removedRowsData: Record<string, any>[]) {
          const rowsToInsert = removedRowsData
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
            for (const { row } of rowsToInsert) {
              recoverLTARRefs(row.row)
              cachedLocalRows.value[row.rowMeta.rowIndex] = row
              syncRowIndex(row.rowMeta.rowIndex, 'create')
              totalRows.value = (totalRows.value || 0) + 1
            }
          }
        },
        args: [removedRowsData],
      },
      redo: {
        fn: async function redo(this: UndoRedoAction, removedRowsData: Record<string, any>[]) {
          await bulkDeleteRows(removedRowsData.map((row) => row.pkData))

          for (const { rowIndex } of removedRowsData) {
            delete cachedLocalRows.value[rowIndex]
            syncRowIndex(rowIndex, 'delete')
            totalRows.value = (totalRows.value || 0) - 1
          }
        },
        args: [removedRowsData],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    try {
      for (const { rowIndex } of removedRowsData) {
        delete cachedLocalRows.value[rowIndex]
        syncRowIndex(rowIndex, 'delete')
        totalRows.value = (totalRows.value || 0) - 1
      }
    } catch (e: any) {
      return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    callbacks?.syncVisibleData?.()

    await callbacks?.syncCount?.()
  }

  async function deleteRangeOfRows(cellRange: CellRange) {
    if (!cellRange._start || !cellRange._end) return

    const start = Math.max(cellRange._start.row, cellRange._end.row)
    const end = Math.min(cellRange._start.row, cellRange._end.row)

    const rowsToDelete: Record<string, any>[] = []
    let compositePrimaryKey = ''

    for (let i = start; i <= end; i++) {
      const cachedRow = cachedLocalRows.value[i]

      const { row: rowData, rowMeta } = cachedRow

      if (!rowMeta.new) {
        const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
        const compositePkValue = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[])
        const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

        if (extractedPk && compositePkValue) {
          if (!compositePrimaryKey) compositePrimaryKey = extractedPk

          rowsToDelete.push({
            [compositePrimaryKey]: compositePkValue as string,
            pkData,
            row: clone(cachedRow) as Row,
            rowIndex: rowMeta.rowIndex,
          })
        }
      }
    }

    if (!rowsToDelete.length) return

    const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
      pks: rowsToDelete.map((row) => row[compositePrimaryKey]).join(','),
    })

    try {
      for (const removedRow of rowsToDelete) {
        const rowObj = removedRow.row
        const rowPk = rowPkData(rowObj.row, meta?.value?.columns as ColumnType[])
        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => rowPk[key] === r[key])
        })
        rowObj.row = clone(fullRecord)
      }
      await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))

      rowsToDelete.forEach(({ virtualIndex }) => {
        delete cachedLocalRows.value[virtualIndex]
        syncRowIndex(virtualIndex, 'delete')
        totalRows.value = (totalRows.value || 1) - 1
      })
    } catch (e: any) {
      return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }

    try {
      addUndo({
        undo: {
          fn: async function undo(this: UndoRedoAction, localDeletedRows: Record<string, any>[]) {
            const rowsToInsert = localDeletedRows.map(({ row }) => {
              const pkData = rowPkData(row.row, meta.value?.columns as ColumnType[])
              return { ...pkData, ...row.row }
            })

            const insertedRowIds = await bulkInsertRows(rowsToInsert, undefined, true)

            if (Array.isArray(insertedRowIds)) {
              localDeletedRows.forEach(({ virtualIndex, row }) => {
                cachedLocalRows.value[virtualIndex] = row
                syncRowIndex(virtualIndex, 'create')
                totalRows.value = (totalRows.value || 0) + 1
              })
            }

            await callbacks?.syncCount?.()
          },
          args: [rowsToDelete],
        },
        redo: {
          fn: async function redo(this: UndoRedoAction, rowsToDelete: Array<Record<string, any>>) {
            await bulkDeleteRows(rowsToDelete.map((row) => row.pkData))

            rowsToDelete.forEach(({ virtualIndex }) => {
              delete cachedLocalRows.value[virtualIndex]
              totalRows.value = (totalRows.value || 0) - 1
              syncRowIndex(virtualIndex, 'delete')
            })

            await callbacks?.syncCount?.()
          },
          args: [rowsToDelete],
        },
        scope: defineViewScope({ view: viewMeta.value }),
      })

      await callbacks?.syncCount?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    callbacks?.syncVisibleData?.()
  }

  async function bulkDeleteRows(
    rows: Record<string, string>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    try {
      const bulkDeletedRowsData = await $api.dbDataTableRow.delete(metaValue?.id as string, rows.length === 1 ? rows[0] : rows, {
        viewId: viewMetaValue?.id as string,
      })
      await reloadAggregate?.trigger()

      return rows.length === 1 && bulkDeletedRowsData ? [bulkDeletedRowsData] : bulkDeletedRowsData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const removeRowIfNew = (row: Row) => {
    const index = row.rowMeta.rowIndex!

    if (index > -1 && row.rowMeta.new) {
      delete cachedLocalRows.value[index]
      return true
    }
    return false
  }

  // This function would be called by your infinite scroll component
  const loadRows = async (startIndex: number, endIndex: number) => {
    try {
      const { list } = await $api.dbTableRow.list(NOCO, base?.value.id as string, meta.value?.id as string, {
        offset: startIndex,
        limit: endIndex - startIndex + 1,
        where: '',
        viewId: viewMeta.value!.id as string,
      })

      list.forEach((row: any, index: number) => {
        const virtualIndex = startIndex + index
        cachedLocalRows.value[virtualIndex] = {
          row,
          oldRow: clone(row),
          rowMeta: { rowIndex: virtualIndex },
        }
      })

      clearCache(startIndex, endIndex)
      // callbacks?.syncVisibleData()
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  async function syncCount() {
    const { count } = await $api.dbViewRow.count(
      NOCO,
      base?.value?.id as string,
      meta.value!.id as string,
      viewMeta?.value?.id as string,
    )

    if (!count) {
      totalRows.value = Infinity
    }
    totalRows.value = count as number
    callbacks?.syncVisibleData?.()
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
    loadRows,
    cachedLocalRows,
    totalRows,
    clearCache,
    syncCount,
    selectedRows,
    syncRowIndex,
    chunkStates,
  }
}

import type { ColumnType, LinkToAnotherRecordType, PaginatedType, RelationTypes, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isAIPromptCol, isCreatedOrLastModifiedByCol, isCreatedOrLastModifiedTimeCol } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { CellRange } from '#imports'

export function useData(args: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>
  formattedData: Ref<Row[]>
  paginationData: Ref<PaginatedType>
  callbacks?: {
    changePage?: (page: number) => Promise<void>
    loadData?: () => Promise<void>
    globalCallback?: (...args: any[]) => Promise<void>
    syncCount?: () => Promise<void>
    syncPagination?: () => Promise<void>
  }
}) {
  const { meta, viewMeta, formattedData, paginationData, callbacks } = args

  const { t } = useI18n()

  const { getMeta, metas } = useMetas()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const { base } = storeToRefs(useBase())

  const { $api } = useNuxtApp()

  const { isPaginationLoading } = storeToRefs(useViewsStore())

  const reloadAggregate = inject(ReloadAggregateHookInj)

  const selectedAllRecords = computed({
    get() {
      return !!formattedData.value.length && formattedData.value.every((row: Row) => row.rowMeta.selected)
    },
    set(selected: boolean) {
      formattedData.value.forEach((row: Row) => (row.rowMeta.selected = selected))
    },
  })

  function addEmptyRow(addAfter = formattedData.value.length, metaValue = meta.value) {
    formattedData.value.splice(addAfter, 0, {
      row: { ...rowDefaultData(metaValue?.columns) },
      oldRow: {},
      rowMeta: { new: true },
    })

    return formattedData.value[addAfter]
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

      if (!undo) {
        Object.assign(currentRow, {
          row: { ...insertedData, ...row },
          rowMeta: { ...(currentRow.rowMeta || {}), new: undefined },
          oldRow: { ...insertedData },
        })

        const id = extractPkFromRow(insertedData, metaValue?.columns as ColumnType[])
        const pkData = rowPkData(insertedData, metaValue?.columns as ColumnType[])
        const rowIndex = findIndexByPk(pkData, formattedData.value)

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
                  await callbacks?.changePage?.(pg.page)
                }
              } else {
                await callbacks?.loadData?.()
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

      await callbacks?.syncCount?.()
      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      if (currentRow.rowMeta) currentRow.rowMeta.saving = false
      await callbacks?.globalCallback?.()
    }
  }

  async function bulkInsertRows(
    rows: Row[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
  ) {
    isPaginationLoading.value = true

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
        )?.filter(Boolean) ?? [] // Filter out undefined values (if any)

      const bulkInsertedIds = await $api.dbDataTableRow.create(metaValue?.id as string, rowsToInsert, {
        viewId: viewMetaValue?.id as string,
      })

      await callbacks?.syncCount?.()
      return bulkInsertedIds
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      await callbacks?.globalCallback?.()
      isPaginationLoading.value = false
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

      const updatedRowData: Record<string, any> = await $api.dbViewRow.update(
        NOCO,
        base?.value.id as string,
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
      await reloadAggregate?.trigger({ fields: [{ title: property }] })

      if (!undo) {
        addUndo({
          redo: {
            fn: async function redo(toUpdate: Row, property: string, pg: { page: number; pageSize: number }) {
              const updatedData = await updateRowProperty(toUpdate, property, undefined, true)
              if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]), formattedData.value)
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, updatedData)
                  Object.assign(row.oldRow, updatedData)
                } else {
                  await callbacks?.loadData?.()
                }
              } else {
                await callbacks?.changePage?.(pg.page)
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
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]), formattedData.value)
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, updatedData)
                  Object.assign(row.oldRow, updatedData)
                } else {
                  await callbacks?.loadData?.()
                }
              } else {
                await callbacks?.changePage?.(pg.page)
              }
            },
            args: [clone(toUpdate), property, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
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
              col.title in updatedRowData &&
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
                isAIPromptCol(col) ||
                col.au ||
                (isValidValue(col?.cdf) && / on update /i.test(col.cdf)))
            )
              acc[col.title!] = updatedRowData[col.title!]
            return acc
          }, {} as Record<string, any>),
        )
        Object.assign(toUpdate.oldRow, updatedRowData)
      }

      await callbacks?.globalCallback?.()

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
          fn: async function redo(redoRows: Row[], props: string[], pg: { page: number; pageSize: number }) {
            await bulkUpdateRows(redoRows, props, { metaValue, viewMetaValue }, true)
            if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
              for (const toUpdate of redoRows) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]), formattedData.value)
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, toUpdate.row)
                  Object.assign(row.oldRow, toUpdate.row)
                } else {
                  await callbacks?.loadData?.()
                  break
                }
              }
            } else {
              await callbacks?.changePage?.(pg.page)
            }
          },
          args: [clone(rows), clone(props), { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
        },
        undo: {
          fn: async function undo(undoRows: Row[], props: string[], pg: { page: number; pageSize: number }) {
            await bulkUpdateRows(undoRows, props, { metaValue, viewMetaValue }, true)
            if (pg.page === paginationData.value.page && pg.pageSize === paginationData.value.pageSize) {
              for (const toUpdate of undoRows) {
                const rowIndex = findIndexByPk(rowPkData(toUpdate.row, meta?.value?.columns as ColumnType[]), formattedData.value)
                if (rowIndex !== -1) {
                  const row = formattedData.value[rowIndex]
                  Object.assign(row.row, toUpdate.row)
                  Object.assign(row.oldRow, toUpdate.row)
                } else {
                  await callbacks?.loadData?.()
                  break
                }
              }
            } else {
              await callbacks?.changePage?.(pg.page)
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

    for (const row of rows) {
      if (row.rowMeta) row.rowMeta.saving = false
    }

    // reload data since row update may change the other columns data( Formula, QrCode, Barcode, Rollup, Checkbox, User, Auto Updated Datetime, etc...)
    if (
      metaValue!.columns!.some((col) =>
        [
          UITypes.QrCode,
          UITypes.LastModifiedTime,
          UITypes.Barcode,
          UITypes.Formula,
          UITypes.Lookup,
          UITypes.Rollup,
          UITypes.LinkToAnotherRecord,
          UITypes.LastModifiedBy,
        ].includes(col.uidt),
      )
    ) {
      await callbacks?.loadData?.()
    }
    await callbacks?.globalCallback?.()
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

    await callbacks?.loadData?.()
    await callbacks?.globalCallback?.()
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
  }

  // Recover LTAR relations for a row using the row data
  const recoverLTARRefs = async (row: Record<string, any>, { metaValue = meta.value }: { metaValue?: TableType } = {}) => {
    const id = extractPkFromRow(row, metaValue?.columns as ColumnType[])
    for (const column of metaValue?.columns ?? []) {
      if (column.uidt !== UITypes.LinkToAnotherRecord) continue

      const colOptions = column.colOptions as LinkToAnotherRecordType

      const relatedTableMeta = metas.value?.[colOptions?.fk_related_model_id as string]

      if (isHm(column) || isMm(column)) {
        const relatedRows = (row[column.title!] ?? []) as Record<string, any>[]

        for (const relatedRow of relatedRows) {
          await linkRecord(
            id,
            extractPkFromRow(relatedRow, relatedTableMeta.columns as ColumnType[]),
            column,
            colOptions.type as RelationTypes,
            { metaValue },
          )
        }
      } else if (isBt(column) && row[column.title!]) {
        await linkRecord(
          id,
          extractPkFromRow(row[column.title!] as Record<string, any>, relatedTableMeta.columns as ColumnType[]),
          column,
          colOptions.type as RelationTypes,
          { metaValue },
        )
      }
    }
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
    return true
  }

  async function deleteRow(rowIndex: number, undo?: boolean) {
    try {
      const row = formattedData.value[rowIndex]
      if (!row.rowMeta.new) {
        const id = extractPkFromRow(row.row, meta?.value?.columns)

        const fullRecord = await $api.dbTableRow.read(
          NOCO,
          // todo: base_id missing on view type
          base?.value.id as string,
          meta.value?.id as string,
          encodeURIComponent(id as string),
          {
            getHiddenColumn: true,
          },
        )

        row.row = fullRecord

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
                const rowIndex = findIndexByPk(pk, formattedData.value)
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
                recoverLTARRefs(row.row)
                if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
                  if (pg.page === paginationData.value.page) {
                    formattedData.value.splice(rowIndex, 0, row)
                  } else {
                    await callbacks?.changePage?.(pg.page)
                  }
                } else {
                  await callbacks?.loadData?.()
                }
              },
              args: [clone(row), {}, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
            },
            scope: defineViewScope({ view: viewMeta.value }),
          })
        }
      }

      formattedData.value.splice(rowIndex, 1)

      await callbacks?.syncCount?.()
    } catch (e: any) {
      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }

    await callbacks?.globalCallback?.()
  }

  async function deleteSelectedRows() {
    let row = formattedData.value.length
    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey = ''

    while (row--) {
      const { row: rowData, rowMeta } = formattedData.value[row] as Record<string, any>
      if (!rowMeta.selected) {
        continue
      }
      if (!rowMeta.new) {
        const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
        const compositePkValue = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[])
        const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

        if (extractedPk && compositePkValue) {
          if (!compositePrimaryKey) compositePrimaryKey = extractedPk

          removedRowsData.push({
            [compositePrimaryKey]: compositePkValue as string,
            pkData,
            row: clone(formattedData.value[row]) as Row,
            rowIndex: row as number,
          })
        }
      }
    }

    if (!removedRowsData.length) return

    isPaginationLoading.value = true

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

    if (!removedRowsData.length) {
      isPaginationLoading.value = false
      return
    }

    addUndo({
      redo: {
        fn: async function redo(this: UndoRedoAction, removedRowsData: Record<string, any>[]) {
          isPaginationLoading.value = true

          const removedRowIds = await bulkDeleteRows(removedRowsData.map((row) => row.pkData))

          if (Array.isArray(removedRowIds)) {
            for (const { row } of removedRowsData) {
              const primaryKey: Record<string, string> = rowPkData(row.row, meta?.value?.columns as ColumnType[])
              const rowIndex = findIndexByPk(primaryKey, formattedData.value)
              if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
              paginationData.value.totalRows = paginationData.value.totalRows! - 1
            }
          }

          await callbacks?.syncCount?.()
          await callbacks?.syncPagination?.()
          await callbacks?.globalCallback?.()
        },
        args: [removedRowsData],
      },
      undo: {
        fn: async function undo(
          this: UndoRedoAction,
          removedRowsData: Record<string, any>[],
          pg: { page: number; pageSize: number },
        ) {
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
            for (const { row, rowIndex } of rowsToInsert) {
              recoverLTARRefs(row.row)

              if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
                if (pg.page === paginationData.value.page) {
                  formattedData.value.splice(rowIndex, 0, row)
                } else {
                  await callbacks?.changePage?.(pg.page)
                }
              } else {
                await callbacks?.loadData?.()
              }
            }
          }
        },
        args: [removedRowsData, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    await callbacks?.syncCount?.()
    await callbacks?.syncPagination?.()
    await callbacks?.globalCallback?.()
  }

  async function deleteRangeOfRows(cellRange: CellRange) {
    if (!cellRange._start || !cellRange._end) return
    const start = Math.max(cellRange._start.row, cellRange._end.row)
    const end = Math.min(cellRange._start.row, cellRange._end.row)

    // plus one because we want to include the end row
    let row = start + 1

    const removedRowsData: Record<string, any>[] = []
    let compositePrimaryKey = ''

    while (row--) {
      try {
        const { row: rowData, rowMeta } = formattedData.value[row] as Record<string, any>

        if (!rowMeta.new) {
          const extractedPk = extractPk(meta?.value?.columns as ColumnType[])
          const compositePkValue = extractPkFromRow(rowData, meta?.value?.columns as ColumnType[])
          const pkData = rowPkData(rowData, meta?.value?.columns as ColumnType[])

          if (extractedPk && compositePkValue) {
            if (!compositePrimaryKey) compositePrimaryKey = extractedPk

            removedRowsData.push({
              [compositePrimaryKey]: compositePkValue as string,
              pkData,
              row: clone(formattedData.value[row]) as Row,
              rowIndex: row as number,
            })
          }
        }
      } catch (e: any) {
        return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }

      if (row === end) break
    }

    if (!removedRowsData.length) return

    isPaginationLoading.value = true

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

    if (!removedRowsData.length) {
      isPaginationLoading.value = false
      return
    }

    addUndo({
      redo: {
        fn: async function redo(this: UndoRedoAction, removedRowsData: Record<string, any>[]) {
          isPaginationLoading.value = true

          const removedRowIds = await bulkDeleteRows(removedRowsData.map((row) => row.pkData))

          if (Array.isArray(removedRowIds)) {
            for (const { row } of removedRowsData) {
              const primaryKey: Record<string, string> = rowPkData(row.row, meta?.value?.columns as ColumnType[])
              const rowIndex = findIndexByPk(primaryKey, formattedData.value)
              if (rowIndex !== -1) formattedData.value.splice(rowIndex, 1)
              paginationData.value.totalRows = paginationData.value.totalRows! - 1
            }
          }

          await callbacks?.syncCount?.()
          await callbacks?.syncPagination?.()
          await callbacks?.globalCallback?.()
        },
        args: [removedRowsData],
      },
      undo: {
        fn: async function undo(
          this: UndoRedoAction,
          removedRowsData: Record<string, any>[],
          pg: { page: number; pageSize: number },
        ) {
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
            for (const { row, rowIndex } of rowsToInsert) {
              recoverLTARRefs(row.row)

              if (rowIndex !== -1 && pg.pageSize === paginationData.value.pageSize) {
                if (pg.page === paginationData.value.page) {
                  formattedData.value.splice(rowIndex, 0, row)
                } else {
                  await callbacks?.changePage?.(pg.page)
                }
              } else {
                await callbacks?.loadData?.()
              }
            }
          }
        },
        args: [removedRowsData, { page: paginationData.value.page, pageSize: paginationData.value.pageSize }],
      },
      scope: defineViewScope({ view: viewMeta.value }),
    })

    await callbacks?.syncCount?.()
    await callbacks?.syncPagination?.()
    await callbacks?.globalCallback?.()
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
    const index = formattedData.value.indexOf(row)

    if (index > -1 && row.rowMeta.new) {
      formattedData.value.splice(index, 1)
      return true
    }
    return false
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
    selectedAllRecords,
    removeRowIfNew,
    bulkDeleteRows,
    bulkInsertRows,
  }
}

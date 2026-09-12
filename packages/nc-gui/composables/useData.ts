import type { ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import { UITypes, isAIPromptCol } from 'nocodb-sdk'
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
  const { meta, viewMeta, formattedData, callbacks } = args

  const { t } = useI18n()

  const { getMeta } = useMetas()

  const { base } = storeToRefs(useBase())

  const { $api } = useNuxtApp()

  const { isPaginationLoading } = storeToRefs(useViewsStore())

  const { user } = useGlobal()

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
      row: { ...rowDefaultData(metaValue?.columns, user.value ?? undefined) },
      oldRow: {},
      rowMeta: { new: true },
    })

    return formattedData.value[addAfter]
  }

  async function insertRow(
    currentRow: Row,
    ltarState: Record<string, any> = {},
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    const row = currentRow.row
    if (currentRow.rowMeta) currentRow.rowMeta.saving = true
    try {
      // Table meta can be transiently undefined (e.g. cleared during navigation/teardown
      // while a deferred save fires) — bail gracefully instead of firing a doomed create.
      if (!metaValue?.columns) {
        return
      }

      const { missingRequiredColumns, insertObj } = await populateInsertObject({
        meta: metaValue!,
        ltarState,
        getMeta,
        row,
      })

      if (missingRequiredColumns.size) {
        const missingFields = [...missingRequiredColumns].filter((f): f is string => typeof f === 'string')
        if (currentRow.rowMeta) {
          currentRow.rowMeta.saveError = {
            reason: 'missingRequired',
            missingFields,
          }
        }
        // useData drives non-canvas views (gallery, kanban) where no
        // inline ⚠️ marker exists, so a toast is the only feedback. This
        // path is one-shot per user action — if it ever gets wired into
        // an inline-edit retry loop (cf. useInfiniteData which drops the
        // toast for that reason), de-dup against the previous saveError.
        const fieldList = missingFields.join(', ')
        message.error(
          missingFields.length === 1
            ? t('msg.error.requiredFieldMissing', { fields: fieldList })
            : t('msg.error.requiredFieldsMissing', { fields: fieldList }),
        )
        return
      }

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        metaValue?.base_id ?? (base?.value.id as string),
        metaValue?.id as string,
        viewMetaValue?.id as string,
        { ...insertObj, ...(ltarState || {}) },
      )

      await reloadAggregate?.trigger()

      Object.assign(currentRow, {
        row: { ...insertedData, ...row },
        rowMeta: { ...(currentRow.rowMeta || {}), new: undefined },
        oldRow: { ...insertedData },
      })

      await callbacks?.syncCount?.()
      return insertedData
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      if (currentRow.rowMeta) currentRow.rowMeta.saving = false
      await callbacks?.globalCallback?.()
    }
  }

  // inside this method use metaValue and viewMetaValue to refer meta
  // since sometimes we need to pass old metas
  async function updateRowProperty(
    toUpdate: Row,
    property: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    if (toUpdate.rowMeta) {
      toUpdate.rowMeta.saving = true

      // Clear previous error for this property if it exists
      if (toUpdate.rowMeta.errors && toUpdate.rowMeta.errors[property]) {
        delete toUpdate.rowMeta.errors[property]
      }
    }

    try {
      const id = extractPkFromRow(toUpdate.row, metaValue?.columns as ColumnType[])

      const updatedRowData: Record<string, any> = await $api.dbViewRow.update(
        NOCO,
        metaValue?.base_id ?? (base?.value.id as string),
        metaValue?.id as string,
        viewMetaValue?.id as string,
        encodeURIComponent(id),
        {
          // if value is undefined treat it as null
          [property]: toUpdate.row[property] ?? null,
        },
        { typecast: 'true' },
      )
      await reloadAggregate?.trigger({ fields: [{ title: property }] })

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

      await callbacks?.globalCallback?.()

      return updatedRowData
    } catch (e: any) {
      toUpdate.row[property] = toUpdate.oldRow[property]
      const msg = await extractSdkResponseErrorMsg(e)

      if (!toUpdate.rowMeta.errors) {
        toUpdate.rowMeta.errors = {}
      }
      toUpdate.rowMeta.errors[property] = msg

      message.error(`${t('msg.error.rowUpdateFailed')}: ${msg}`)
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
    { metaValue = meta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
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

    await $api.dbTableRow.bulkUpdate(NOCO, metaValue?.base_id as string, metaValue?.id as string, updateArray, {
      typecast: 'true',
    })
    await reloadAggregate?.trigger({ fields: props.map((p) => ({ title: p })) })

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

  async function deleteRowById(
    id: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    const res: any = await $api.dbViewRow.delete(
      'noco',
      metaValue?.base_id ?? (base.value.id as string),
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

  async function deleteRow(rowIndex: number) {
    try {
      const row = formattedData.value[rowIndex]
      if (!row.rowMeta.new) {
        const id = extractPkFromRow(row.row, meta?.value?.columns)

        const fullRecord = await $api.dbTableRow.read(
          NOCO,
          // todo: base_id missing on view type
          meta.value?.base_id ?? (base?.value.id as string),
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
            row: deepClone(formattedData.value[row]) as Row,
            rowIndex: row as number,
          })
        }
      }
    }

    if (!removedRowsData.length) return

    isPaginationLoading.value = true

    const { list } = await $api.internal.getOperation((meta.value as any).fk_workspace_id!, meta.value!.base_id!, {
      operation: 'dataList',
      tableId: meta.value?.id as string,
      pks: removedRowsData.map((row) => row[compositePrimaryKey]).join(','),
    })

    try {
      for (const removedRow of removedRowsData) {
        const rowObj = removedRow.row
        const rowPk = rowPkData(rowObj.row, meta?.value?.columns as ColumnType[])
        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => rowPk[key] === r[key])
        })
        rowObj.row = deepClone(fullRecord)
      }

      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))
    } catch (e: any) {
      return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }

    if (!removedRowsData.length) {
      isPaginationLoading.value = false
      return
    }

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
              row: deepClone(formattedData.value[row]) as Row,
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

    const { list } = await $api.internal.getOperation((meta.value as any).fk_workspace_id!, meta.value!.base_id!, {
      operation: 'dataList',
      tableId: meta.value?.id as string,
      pks: removedRowsData.map((row) => row[compositePrimaryKey]).join(','),
    })

    try {
      for (const removedRow of removedRowsData) {
        const rowObj = removedRow.row
        const rowPk = rowPkData(rowObj.row, meta?.value?.columns as ColumnType[])
        const fullRecord = list.find((r: Record<string, any>) => {
          return Object.keys(rowPk).every((key) => rowPk[key] === r[key])
        })
        rowObj.row = deepClone(fullRecord)
      }

      await bulkDeleteRows(removedRowsData.map((row) => row.pkData))
    } catch (e: any) {
      return message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }

    if (!removedRowsData.length) {
      isPaginationLoading.value = false
      return
    }

    await callbacks?.syncCount?.()
    await callbacks?.syncPagination?.()
    await callbacks?.globalCallback?.()
  }

  async function bulkDeleteRows(
    rows: Record<string, string>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
  ) {
    try {
      const bulkDeletedRowsData = await $api.internal.postOperation(
        (metaValue as any).fk_workspace_id!,
        metaValue!.base_id!,
        {
          operation: 'dataDelete',
          tableId: metaValue?.id as string,
          viewId: viewMetaValue?.id as string,
        },
        rows.length === 1 ? rows[0] : rows,
      )
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
  }
}

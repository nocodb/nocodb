import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'

const [useProvideSmartsheetLtarHelpers, useSmartsheetLtarHelpers] = useInjectionState(
  (meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { base } = storeToRefs(useBase())

    const { metas } = useMetas()

    const getRowLtarHelpers = (row: Row) => {
      if (!row.rowMeta) {
        row.rowMeta = {}
      }
      if (!row.rowMeta.ltarState) {
        row.rowMeta.ltarState = {}
      }
      return row.rowMeta.ltarState
    }

    // actions
    const addLTARRef = async (row: Row, value: Record<string, any>, column: ColumnType) => {
      if (isHm(column) || isMm(column)) {
        if (!getRowLtarHelpers(row)[column.title!]) getRowLtarHelpers(row)[column.title!] = []

        if (getRowLtarHelpers(row)[column.title!]!.find((ln: Record<string, any>) => deepCompare(ln, value))) {
          // This value is already in the list
          return message.info(t('msg.info.valueAlreadyInList'))
        }

        if (Array.isArray(value)) {
          getRowLtarHelpers(row)[column.title!]!.push(...value)
        } else {
          getRowLtarHelpers(row)[column.title!]!.push(value)
        }
      } else if (isBt(column) || isOo(column)) {
        getRowLtarHelpers(row)[column.title!] = value
      }
    }

    // actions
    const removeLTARRef = async (row: Row, value: Record<string, any>, column: ColumnType) => {
      if (isHm(column) || isMm(column)) {
        getRowLtarHelpers(row)[column.title!]?.splice(getRowLtarHelpers(row)[column.title!]?.indexOf(value), 1)
      } else if (isBt(column) || isOo(column)) {
        getRowLtarHelpers(row)[column.title!] = null
      }
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
          type,
          column.id as string,
          encodeURIComponent(relatedRowId),
        )
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    /** sync LTAR relations kept in local state */
    const syncLTARRefs = async (
      row: Row,
      rowData: Record<string, any>,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
    ) => {
      const id = extractPkFromRow(rowData, metaValue?.columns as ColumnType[])
      for (const column of metaValue?.columns ?? []) {
        if (!isLinksOrLTAR(column)) continue

        const colOptions = column.colOptions as LinkToAnotherRecordType

        const relatedTableMeta = metas.value?.[colOptions?.fk_related_model_id as string]

        if (isHm(column) || isMm(column)) {
          const relatedRows = (getRowLtarHelpers(row)?.[column.title!] ?? []) as Record<string, any>[]

          for (const relatedRow of relatedRows) {
            await linkRecord(
              id,
              extractPkFromRow(relatedRow, relatedTableMeta.columns as ColumnType[]),
              column,
              colOptions.type as RelationTypes,
              { metaValue },
            )
          }
        } else if ((isBt(column) || isOo(column)) && getRowLtarHelpers(row)?.[column.title!]) {
          await linkRecord(
            id,
            extractPkFromRow(
              getRowLtarHelpers(row)?.[column.title!] as Record<string, any>,
              relatedTableMeta.columns as ColumnType[],
            ),
            column,
            colOptions.type as RelationTypes,
            { metaValue },
          )
        }

        // clear LTAR refs after sync
        getRowLtarHelpers(row)[column.title!] = null
      }
    }

    // clear LTAR cell
    const clearLTARCell = async (row: Row, column: ColumnType) => {
      try {
        if (!column || !isLinksOrLTAR(column)) return

        const relatedTableMeta = metas.value?.[(<LinkToAnotherRecordType>column?.colOptions)?.fk_related_model_id as string]

        if (row.rowMeta.new) {
          getRowLtarHelpers(row)[column.title!] = null
        } else {
          if ([RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes((<LinkToAnotherRecordType>column.colOptions)?.type)) {
            if (!row.row[column.title!]) return
            await $api.dbTableRow.nestedRemove(
              NOCO,
              base.value.id as string,
              meta.value?.id as string,
              extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
              (<LinkToAnotherRecordType>column.colOptions)?.type as any,
              column.id as string,
              extractPkFromRow(row.row[column.title!], relatedTableMeta?.columns as ColumnType[]),
            )
            row.row[column.title!] = null
          } else {
            for (const link of (row.row[column.title!] as Record<string, any>[]) || []) {
              await $api.dbTableRow.nestedRemove(
                NOCO,
                base.value.id as string,
                meta.value?.id as string,
                encodeURIComponent(extractPkFromRow(row.row, meta.value?.columns as ColumnType[])),
                (<LinkToAnotherRecordType>column?.colOptions).type as 'hm' | 'mm',
                column.id as string,
                encodeURIComponent(extractPkFromRow(link, relatedTableMeta?.columns as ColumnType[])),
              )
            }
            row.row[column.title!] = []
          }
        }
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    const loadRow = async (row: Row) => {
      const record = await $api.dbTableRow.read(
        NOCO,
        base.value?.id as string,
        meta.value?.title as string,
        encodeURIComponent(extractPkFromRow(row.row, meta.value?.columns as ColumnType[])),
      )
      Object.assign(unref(row), {
        row: record,
        oldRow: { ...record },
        rowMeta: {
          ...row.rowMeta,
          new: false,
        },
      })
    }

    // clear MM cell
    const cleaMMCell = async (row: Row, column: ColumnType) => {
      try {
        if (!column || !isLinksOrLTAR(column)) return

        if (row.rowMeta.new) {
          getRowLtarHelpers(row)[column.title!] = null
        } else {
          if ((<LinkToAnotherRecordType>column.colOptions)?.type === RelationTypes.MANY_TO_MANY) {
            if (!row.row[column.title!]) return

            const result = await $api.dbDataTableRow.nestedListCopyPasteOrDeleteAll(
              meta.value?.id as string,
              column.id as string,
              [
                {
                  operation: 'deleteAll',
                  rowId: extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) as string,
                  columnId: column.id as string,
                  fk_related_model_id: (column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
                },
              ],
            )

            row.row[column.title!] = null

            return Array.isArray(result.unlink) ? result.unlink : []
          }
        }
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    return {
      addLTARRef,
      removeLTARRef,
      syncLTARRefs,
      loadRow,
      clearLTARCell,
      cleaMMCell,
    }
  },
  'smartsheet-ltar-helpers',
)

export { useProvideSmartsheetLtarHelpers }

export function useSmartsheetLtarHelpersOrThrow() {
  const smartsheetLtarHelpers = useSmartsheetLtarHelpers()

  if (smartsheetLtarHelpers == null) throw new Error('Please call `useSmartsheetLtarHelpers` on the appropriate parent component')

  return smartsheetLtarHelpers
}

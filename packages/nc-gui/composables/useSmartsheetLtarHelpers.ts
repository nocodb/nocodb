import { RelationTypes, isBtLikeV2Junction, isLinksOrLTAR, isMMOrMMLike } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'

const [useProvideSmartsheetLtarHelpers, useSmartsheetLtarHelpers] = useInjectionState(
  (meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { base } = storeToRefs(useBase())

    const { getMetaByKey } = useMetas()

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
    // `skipRowDisplay` keeps `row.row` untouched — used for existing records edited in
    // the expanded form, where the visible links come from the API-loaded children list,
    // not `row.row`. New rows leave it false so the buffered links drive the cell display.
    const addLTARRef = async (
      row: Row,
      value: Record<string, any>,
      column: ColumnType,
      { skipRowDisplay = false }: { skipRowDisplay?: boolean } = {},
    ) => {
      // V2 MO/OO uses junction table but is single-record — treat as BT
      if (isBtLikeV2Junction(column) || isBt(column) || isOo(column)) {
        getRowLtarHelpers(row)[column.title!] = value
        if (!skipRowDisplay) row.row[column.title!] = value
      } else if (isHm(column) || isMm(column) || isMMOrMMLike(column)) {
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
        // Also update row.row so cellValue triggers re-render
        if (!skipRowDisplay) row.row[column.title!] = [...(getRowLtarHelpers(row)[column.title!] || [])]
      }
    }

    // actions
    const removeLTARRef = async (
      row: Row,
      value: Record<string, any>,
      column: ColumnType,
      { skipRowDisplay = false }: { skipRowDisplay?: boolean } = {},
    ) => {
      // V2 MO/OO uses junction table but is single-record — treat as BT
      if (isBtLikeV2Junction(column) || isBt(column) || isOo(column)) {
        getRowLtarHelpers(row)[column.title!] = null
        if (!skipRowDisplay) row.row[column.title!] = null
      } else if (isHm(column) || isMm(column) || isMMOrMMLike(column)) {
        const idx = getRowLtarHelpers(row)[column.title!]?.findIndex((ln: Record<string, any>) => deepCompare(ln, value)) ?? -1
        if (idx !== -1) getRowLtarHelpers(row)[column.title!]?.splice(idx, 1)
        if (!skipRowDisplay) row.row[column.title!] = [...(getRowLtarHelpers(row)[column.title!] || [])]
      }
    }

    // clear LTAR cell
    const clearLTARCell = async (row: Row, column: ColumnType) => {
      try {
        if (!column || !isLinksOrLTAR(column)) return

        const relatedTableMeta = getMetaByKey(
          meta.value?.base_id,
          (<LinkToAnotherRecordType>column?.colOptions)?.fk_related_model_id as string,
        )

        if (row.rowMeta.new) {
          getRowLtarHelpers(row)[column.title!] = null
        } else {
          if ([RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes((<LinkToAnotherRecordType>column.colOptions)?.type)) {
            if (!row.row[column.title!]) return
            await $api.dbTableRow.nestedRemove(
              NOCO,
              meta.value?.base_id ?? (base.value.id as string),
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
                meta.value?.base_id ?? (base.value.id as string),
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
      // Callers (e.g. the attachment Carousel's reload-on-media-error flow) must not let a
      // failed refetch (404 if the row was deleted meanwhile, a transient network error, etc.)
      // escape as an uncaught rejection — that would bubble past this composable's callers,
      // get caught by the top-level ErrorBoundary, and crash the whole page instead of just
      // failing the reload. Mirrors the error handling in useExpandedFormStore's loadRow.
      let record: Record<string, any>
      try {
        record = await $api.dbTableRow.read(
          NOCO,
          meta.value?.base_id ?? (base.value?.id as string),
          meta.value?.title as string,
          encodeURIComponent(extractPkFromRow(row.row, meta.value?.columns as ColumnType[])),
        )
      } catch (e: any) {
        if (e?.response?.status === 404) {
          message.error(t('msg.noRecordFound'))
        } else {
          message.error(await extractSdkResponseErrorMsg(e))
        }
        return
      }
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
          if (isMMOrMMLike(column)) {
            if (!row.row[column.title!]) return

            const result = await $api.internal.postOperation(
              meta.value?.fk_workspace_id ?? base.value.fk_workspace_id,
              meta.value?.base_id ?? base.value.id,
              {
                operation: 'nestedDataListCopyPasteOrDeleteAll',
                tableId: meta.value?.id as string,
                columnId: column.id as string,
              },
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

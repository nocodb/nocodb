import { RelationTypes, isBtLikeV2Junction, isLinksOrLTAR, isMMOrMMLike } from 'nocodb-sdk'
import type { ColumnType, LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { InterfacePageDataApi } from '~/lib/interfaceData'

const [useProvideSmartsheetLtarHelpers, useSmartsheetLtarHelpers] = useInjectionState(
  (
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    // Interface page adapter — unlink-style writes re-route through the
    // page-scoped ops (interface collaborators may hold no base role, so the
    // raw endpoints 403 with empty roles). Rides as a PARAM, not inject: the
    // interface hosts that provide `InterfacePageDataInj` also call this
    // provider in the SAME instance, and a same-instance `provide()` is
    // invisible to this composable's own `inject()` (the useProvideViewGroupBy
    // precedent). CE hosts pass nothing.
    interfaceDataApi?: InterfacePageDataApi,
  ) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const { base } = storeToRefs(useBase())

    const { getMetaByKey } = useMetas()

    const unlinkViaApi = async (rowId: string, column: ColumnType, refRowId: string, relationType: string) => {
      if (interfaceDataApi?.nestedUnlink) {
        await interfaceDataApi.nestedUnlink({ rowId, columnId: column.id as string, refRowIds: [refRowId] })
      } else {
        await $api.dbTableRow.nestedRemove(
          NOCO,
          meta.value?.base_id ?? (base.value.id as string),
          meta.value?.id as string,
          encodeURIComponent(rowId),
          relationType as any,
          column.id as string,
          encodeURIComponent(refRowId),
        )
      }
    }

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
            await unlinkViaApi(
              extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
              column,
              extractPkFromRow(row.row[column.title!], relatedTableMeta?.columns as ColumnType[]),
              (<LinkToAnotherRecordType>column.colOptions)?.type,
            )
            row.row[column.title!] = null
          } else {
            for (const link of (row.row[column.title!] as Record<string, any>[]) || []) {
              await unlinkViaApi(
                extractPkFromRow(row.row, meta.value?.columns as ColumnType[]),
                column,
                extractPkFromRow(link, relatedTableMeta?.columns as ColumnType[]),
                (<LinkToAnotherRecordType>column?.colOptions).type,
              )
            }
            row.row[column.title!] = []
          }
        }
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    const loadRow = async (row: Row, { silent = false }: { silent?: boolean } = {}) => {
      // Callers (e.g. the attachment Carousel's reload-on-media-error flow) must not let a
      // failed refetch (404 if the row was deleted meanwhile, a transient network error, etc.)
      // escape as an uncaught rejection — that would bubble past this composable's callers,
      // get caught by the top-level ErrorBoundary, and crash the whole page instead of just
      // failing the reload. Mirrors the error handling in useExpandedFormStore's loadRow.
      //
      // `silent` is for background self-heal callers (e.g. Carousel's media-error reload):
      // a failure there is not something the user asked for, so surface it in the console only
      // instead of a toast — otherwise a benign transient failure looks like a data-loss bug.
      let record: Record<string, any>
      try {
        record = await $api.dbTableRow.read(
          NOCO,
          meta.value?.base_id ?? (base.value?.id as string),
          meta.value?.title as string,
          encodeURIComponent(extractPkFromRow(row.row, meta.value?.columns as ColumnType[])),
        )
      } catch (e: any) {
        if (silent) {
          console.error('loadRow: silent background refetch failed', e)
        } else if (e?.response?.status === 404) {
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

            const deleteAllOps = [
              {
                operation: 'deleteAll' as const,
                rowId: extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) as string,
                columnId: column.id as string,
                fk_related_model_id: (column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id as string,
              },
            ]

            // Interface pages route through the page-scoped op — the raw op
            // is base-scoped and 403s for interface collaborators.
            const result = interfaceDataApi?.nestedCopyPaste
              ? await interfaceDataApi.nestedCopyPaste(deleteAllOps)
              : await $api.internal.postOperation(
                  meta.value?.fk_workspace_id ?? base.value.fk_workspace_id,
                  meta.value?.base_id ?? base.value.id,
                  {
                    operation: 'nestedDataListCopyPasteOrDeleteAll',
                    tableId: meta.value?.id as string,
                    columnId: column.id as string,
                  },
                  deleteAllOps,
                )

            row.row[column.title!] = null

            return Array.isArray(result?.unlink) ? result.unlink : []
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

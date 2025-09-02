import type { LinkToAnotherRecordType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, UITypesName, isLinksOrLTAR } from 'nocodb-sdk'
import type { CanvasGridColumn } from '~/lib/types'

export function columnTypeName(column: CanvasGridColumn) {
  if (column?.columnObj.uidt === UITypes.LongText) {
    if (parseProp(column?.columnObj?.meta)?.richMode) {
      return UITypesName.RichText
    }

    if (parseProp(column.columnObj?.meta)?.[LongTextAiMetaProp]) {
      return UITypesName.AIPrompt
    }
  }

  return column.columnObj.uidt ? UITypesName[column.columnObj.uidt!] : ''
}
export function getCustomColumnTooltip({
  column,
  metas,
  getMeta,
  isExternalLink = false,
}: {
  column: CanvasGridColumn
  metas: Record<string, TableType>
  isExternalLink: boolean
  getMeta?: (tableId: string) => Promise<TableType>
}): string {
  if (!isLinksOrLTAR(column.columnObj)) {
    return
  }
  const relOptions = column.columnObj.colOptions as LinkToAnotherRecordType

  if (!isExternalLink && !column.columnObj?.meta?.custom) {
    return
  }

  if (!relOptions) return

  const currentTable = metas[column.columnObj.fk_model_id]
  const refTable = metas[relOptions.fk_related_model_id]
  let mmTable: TableType
  if (relOptions.type === RelationTypes.MANY_TO_MANY) {
    if (metas[relOptions.fk_mm_model_id]) {
      mmTable = metas[relOptions.fk_mm_model_id]
    } else {
      // if metas not found in store, fetch it
      getMeta?.(relOptions.fk_mm_model_id).catch((e) => {
        // do nothing
      })
    }
  }

  let currentTableColName = ''
  let refTableColName = ''
  let mmTableColName = ''
  let mmTableRefColName = ''

  if (
    relOptions.type === RelationTypes.MANY_TO_MANY ||
    relOptions.type === RelationTypes.BELONGS_TO ||
    (relOptions.type === RelationTypes.ONE_TO_ONE && column.columnObj?.meta?.bt)
  ) {
    currentTableColName = currentTable?.columns?.find((c) => c.id === relOptions.fk_child_column_id)?.title
    refTableColName = refTable?.columns?.find((c) => c.id === relOptions.fk_parent_column_id)?.title
    if (mmTable) {
      mmTableColName = mmTable?.columns?.find((c) => c.id === relOptions.fk_mm_child_column_id)?.title
      mmTableRefColName = mmTable?.columns?.find((c) => c.id === relOptions.fk_mm_parent_column_id)?.title
    }
  } else {
    currentTableColName = currentTable?.columns?.find((c) => c.id === relOptions.fk_parent_column_id)?.title
    refTableColName = refTable?.columns?.find((c) => c.id === relOptions.fk_child_column_id)?.title
  }

  // generate a detailed tooltip for link to another record with relation columns and many to many table
  // including column names from the current table, related table and many to many table
  // Format: "Link column: Current table(column in current table) -> Related Table (column in related table)"
  const tooltip = `${columnTypeName(column)}:\n\n ${[
    currentTable?.title,
    currentTableColName ? `(${currentTableColName})` : '',
    ' → ',
    refTable?.title,
    refTableColName ? `(${refTableColName})` : '',
    mmTable ? '\n\nVia ' : '',
    mmTable ? mmTable.title : '',
    mmTableRefColName ? `(${mmTableRefColName})` : '',
    mmTable && mmTableColName ? ',' : '',
    mmTableColName ? `(${mmTableColName})` : '',
  ].join('')}`

  return tooltip
}

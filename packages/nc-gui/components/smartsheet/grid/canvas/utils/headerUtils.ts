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
      // skip if created by NocoDB
      mmTable = metas[relOptions.fk_mm_model_id]?.title?.includes('nc_m2m_') ? null : metas[relOptions.fk_mm_model_id]
    } else {
      // if metas not found in store, fetch it
      getMeta?.(relOptions.fk_mm_model_id).catch((_e) => {
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

  // Generate a detailed tooltip for link-to-record fields.
  // The tooltip includes:
  // - Column type
  // - Current table and column
  // - Related table and column
  // - (Optional) many-to-many table with its linking columns
  //
  // Format example:
  //   Link column: Customers(id) → Products(product_id)
  //
  //   Through Orders_Products(customer_id, product_id)
  const tooltip = `${columnTypeName(column)}: ${[
    // Current table and column
    currentTable?.title || '',
    currentTableColName ? `(${currentTableColName})` : '',

    // Relation arrow
    ' → ',

    // Related table and column
    refTable?.title || '',
    refTableColName ? `(${refTableColName})` : '',

    // Many-to-many (optional)
    mmTable ? '\n\nThrough ' : '',
    mmTable ? mmTable.title : '',
    mmTableColName && mmTableRefColName ? `(${mmTableColName}, ${mmTableRefColName})` : '',
  ].join('')}`

  return tooltip
}

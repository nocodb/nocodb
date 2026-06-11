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
  baseId,
  isExternalLink = false,
}: {
  column: CanvasGridColumn
  metas: Record<string, TableType>
  baseId?: string
  isExternalLink: boolean
  getMeta?: (baseId: string, tableId: string) => Promise<TableType>
}): string {
  if (!isLinksOrLTAR(column.columnObj)) {
    return
  }
  const relOptions = column.columnObj.colOptions as LinkToAnotherRecordType

  if (!isExternalLink && !column.columnObj?.meta?.custom) {
    return
  }

  if (!relOptions) return

  // Get the related base ID for cross-base relationships
  const relatedBaseId = relOptions.fk_related_base_id || baseId

  // Helper to get meta by base and table ID
  const getMetaByKey = (tableBaseId: string | undefined, tableId: string) => {
    if (tableBaseId) {
      return metas[`${tableBaseId}:${tableId}`] || metas[tableId]
    }
    return metas[tableId]
  }

  const currentTable = getMetaByKey(baseId, column.columnObj.fk_model_id)
  const refTable = getMetaByKey(relatedBaseId, relOptions.fk_related_model_id)
  let mmTable: TableType
  if (relOptions.type === RelationTypes.MANY_TO_MANY) {
    // MM table is always in the same base as the related table
    const mmMeta = getMetaByKey(relatedBaseId, relOptions.fk_mm_model_id)
    if (mmMeta) {
      // skip if created by NocoDB
      mmTable = mmMeta?.title?.includes('nc_m2m_') ? null : mmMeta
    } else {
      // if metas not found in store, fetch it with correct base_id
      getMeta?.(relatedBaseId, relOptions.fk_mm_model_id).catch((_e) => {
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

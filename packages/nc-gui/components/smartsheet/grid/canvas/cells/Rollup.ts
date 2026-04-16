import {
  type ColumnType,
  type LinkToAnotherRecordType,
  type RollupType,
  UITypes,
  getMetaWithCompositeKey,
  getRenderAsTextFunForUiType,
  getRollupColumnMeta,
  integerPreservingRollupFunctions,
  integerRollupFunctions,
  isIntegerUiType,
} from 'nocodb-sdk'

import rfdc from 'rfdc'
import { getRelatedBaseId } from '../utils/cell'

const clone = rfdc()
export const RollupCellRenderer: CellRenderer = {
  render: (ctx, props) => {
    const { column, value, metas, meta, renderCell } = props

    // If it is empty text then no need to render
    if (!metas || !isValidValue(value)) return

    const colOptions = column.colOptions as RollupType

    const relatedColObj = getMetaWithCompositeKey(metas, meta?.base_id, column.fk_model_id)?.columns?.find(
      (c: any) => c.id === colOptions?.fk_relation_column_id,
    ) as ColumnType

    if (!relatedColObj) return

    const relatedColOptions = relatedColObj.colOptions as LinkToAnotherRecordType
    if (!relatedColOptions) return

    // Get the correct base ID for the related table (handles cross-base links)
    const relatedBaseId = getRelatedBaseId(relatedColObj, meta?.base_id || '')
    const relatedTableMeta = getMetaWithCompositeKey(metas, relatedBaseId, relatedColOptions.fk_related_model_id)

    const childColumn = clone((relatedTableMeta?.columns || []).find((c: ColumnType) => c.id === colOptions?.fk_rollup_column_id))

    if (!childColumn) return

    let renderProps: CellRendererOptions | undefined
    let isFormulaWithDisplayType = false

    if (childColumn.uidt === UITypes.Formula) {
      const colMeta = parseProp(childColumn.meta)

      if (colMeta?.display_type) {
        isFormulaWithDisplayType = true
        const displayColumnMeta = parseProp(colMeta.display_column_meta)

        renderProps = {
          ...props,
          column: {
            ...childColumn,
            uidt: colMeta?.display_type,
            ...displayColumnMeta,
            meta: {
              ...parseProp(displayColumnMeta?.meta),
              ...getRollupColumnMeta(column?.meta, colMeta?.display_type, colOptions?.rollup_function),
            },
          },
          readonly: true,
          formula: true,
        }
      }
    }

    if (!renderProps) {
      renderProps = {
        ...props,
        column: childColumn,
        relatedColObj: undefined,
        relatedTableMeta: undefined,
        readonly: true,
      }
    }

    const renderAsTextFun = getRenderAsTextFunForUiType((renderProps.column?.uidt as UITypes) || UITypes.SingleLineText)

    // Only overwrite meta for non-formula display types — formula display types
    // already have the correct meta (e.g., currency_code) set above
    if (!isFormulaWithDisplayType) {
      renderProps.column.meta = {
        ...parseProp(childColumn?.meta),
        ...getRollupColumnMeta(column?.meta, childColumn?.uidt as UITypes, colOptions?.rollup_function),
      }
    }

    if (colOptions?.rollup_function && renderAsTextFun.includes(colOptions?.rollup_function)) {
      const isInteger =
        integerRollupFunctions.includes(colOptions.rollup_function) ||
        (isIntegerUiType(renderProps.column as ColumnType) &&
          integerPreservingRollupFunctions.includes(colOptions.rollup_function))

      renderProps.column.uidt = isInteger ? UITypes.Number : UITypes.Decimal
    }

    renderCell(ctx, renderProps.column, renderProps)
  },
}

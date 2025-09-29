import {
  ClientType,
  SqlUiFactory,
  UITypes,
  comparisonOpList,
  comparisonSubOpList,
  deleteFilterWithSub,
  getEquivalentUIType,
  getFilterCount,
  getPlaceholderNewRow,
  isComparisonOpAllowed,
  isDateType,
  isSystemColumn,
  isVirtualCol,
  parseProp,
} from 'nocodb-sdk'
import type {
  ColumnType,
  ColumnTypeForFilter,
  ComparisonOpUiType,
  FilterGroupChangeEvent,
  FilterRowChangeEvent,
  LinkToAnotherRecordType,
  LookupType,
  TableType,
} from 'nocodb-sdk'

export const MAX_NESTED_LEVEL = 5
export const excludedFilterColUidt = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

// Re-export types from nocodb-sdk for backward compatibility
export type { ComparisonOpUiType, FilterGroupChangeEvent, FilterRowChangeEvent, ColumnTypeForFilter }

// Re-export functions from nocodb-sdk for backward compatibility
export {
  isDateType,
  comparisonOpList,
  comparisonSubOpList,
  getPlaceholderNewRow,
  isComparisonOpAllowed,
  getFilterCount,
  deleteFilterWithSub,
}

export const isComparisonSubOpAllowed = (
  filter: ColumnFilterType,
  compOp: {
    text: string
    value: string
    ignoreVal?: boolean
    includedTypes?: UITypes[]
    excludedTypes?: UITypes[]
  },
  uidt?: UITypes,
) => {
  if (compOp.includedTypes) {
    // include allowed values only if selected column type matches
    return filter.fk_column_id && compOp.includedTypes.includes(uidt!)
  } else if (compOp.excludedTypes) {
    // include not allowed values only if selected column type not matches
    return filter.fk_column_id && !compOp.excludedTypes.includes(uidt!)
  }
}

// filter is draft if it's not saved to db yet
export const isFilterDraft = (filter: Filter, col: ColumnTypeForFilter) => {
  if (filter.id) return false

  if (
    filter.comparison_op &&
    comparisonSubOpList(filter.comparison_op, parseProp(col?.meta)?.date_format).find(
      (compOp) => compOp.value === filter.comparison_sub_op,
    )?.ignoreVal
  ) {
    return false
  }

  if (
    comparisonOpList((col.filterUidt ?? col.uidt) as UITypes, parseProp(col?.meta)?.date_format).find(
      (compOp) => compOp.value === filter.comparison_op,
    )?.ignoreVal
  ) {
    return false
  }

  if (filter.value) {
    return false
  }

  return true
}

export const isDynamicFilterAllowed = (filter: ColumnFilterType, column?: ColumnType, dbClientType?: ClientType) => {
  if (!column) {
    return false
  }
  // if virtual column, don't allow dynamic filter
  if (isVirtualCol(column)) return false
  const sqlUi = SqlUiFactory.create({ client: dbClientType ?? ClientType.PG })

  // disable dynamic filter for certain fields like rating, attachment, etc
  if (
    [
      UITypes.Attachment,
      UITypes.Rating,
      UITypes.Checkbox,
      UITypes.QrCode,
      UITypes.Barcode,
      UITypes.Collaborator,
      UITypes.GeoData,
      UITypes.SpecificDBType,
    ].includes(column.uidt as UITypes)
  )
    return false

  const abstractType = sqlUi.getAbstractType(column)

  if (!['integer', 'float', 'text', 'string'].includes(abstractType)) return false

  return !filter.comparison_op || ['eq', 'lt', 'gt', 'lte', 'gte', 'like', 'nlike', 'neq'].includes(filter.comparison_op)
}

export const getDynamicColumns = (metaColumns: ColumnType[], column?: ColumnType, dbClientType?: ClientType) => {
  if (!column) return []
  const sqlUi = SqlUiFactory.create({ client: dbClientType ?? ClientType.PG })

  return metaColumns.filter((c: ColumnType) => {
    if (excludedFilterColUidt.includes(c.uidt as UITypes) || isVirtualCol(c) || (isSystemColumn(c) && !c.pk)) {
      return false
    }

    const dynamicColAbstractType = sqlUi.getAbstractType(c)

    const filterColAbstractType = sqlUi.getAbstractType(column)

    // treat float and integer as number
    if ([dynamicColAbstractType, filterColAbstractType].every((type) => ['float', 'integer'].includes(type))) {
      return true
    }

    // treat text and string as string
    if ([dynamicColAbstractType, filterColAbstractType].every((type) => ['text', 'string'].includes(type))) {
      return true
    }

    return filterColAbstractType === dynamicColAbstractType
  })
}

export const getFilterUidt = (col: ColumnTypeForFilter): UITypes => {
  if (col.uidt === UITypes.Formula) {
    const formulaUIType = getEquivalentUIType({
      formulaColumn: col,
    })

    return (formulaUIType || col.uidt) as UITypes
  }
  // if column is a lookup column, then use the lookup type extracted from the column
  else if (col.btLookupColumn) {
    return col.btLookupColumn.uidt as UITypes
  } else {
    return col.uidt as UITypes
  }
}

export const composeColumnsForFilter = async ({
  rootMeta,
  getMeta,
}: {
  rootMeta: TableType
  getMeta: (metaIdOrTitle: string) => Promise<TableType | null>
}) => {
  const result: ColumnTypeForFilter[] = []
  for (const column of rootMeta.columns!) {
    if (column.uidt !== UITypes.Lookup) {
      result.push({ ...column, filterUidt: getFilterUidt(column) })
      continue
    }

    let nextCol: ColumnType | undefined = column
    // check all the relation of nested lookup columns is bt or not
    // include the column only if all only if all relations are bt
    while (nextCol && nextCol.uidt === UITypes.Lookup) {
      // extract the relation column meta
      const lookupRelation: ColumnType | undefined = (await getMeta(nextCol.fk_model_id!))?.columns?.find(
        (c) => c.id === (nextCol!.colOptions as LookupType).fk_relation_column_id,
      )
      // this is less likely to happen but if relation column is not found then break the loop
      if (!lookupRelation) {
        break
      }

      const relatedTableMeta: TableType | null = await getMeta(
        (lookupRelation?.colOptions as LinkToAnotherRecordType).fk_related_model_id!,
      )
      nextCol = relatedTableMeta?.columns?.find((c) => c.id === (nextCol!.colOptions as LookupType).fk_lookup_column_id)

      // if next column is same as root lookup column then break the loop
      // since it's going to be a circular loop
      if (nextCol?.id === column.id) {
        break
      }
    }
    const columnTypeForFilter: ColumnTypeForFilter = {
      ...column,
      btLookupColumn: nextCol,
    }
    columnTypeForFilter.filterUidt = getFilterUidt(columnTypeForFilter)
    result.push(columnTypeForFilter)
  }
  return result
}

export const adjustFilterWhenColumnChange = ({
  filter,
  column,
  showNullAndEmptyInFilter,
}: {
  filter: ColumnFilterType
  column: ColumnTypeForFilter
  showNullAndEmptyInFilter?: boolean
}) => {
  if (!column) return

  const evalUidt: UITypes = column.filterUidt ?? column.uidt
  if (isVirtualCol(column)) {
    filter.dynamic = false
    filter.fk_value_col_id = null
  } else {
    filter.fk_value_col_id = null
  }
  filter.comparison_op = comparisonOpList(evalUidt, parseProp(column.meta)?.date_format).find((compOp) =>
    isComparisonOpAllowed(filter, compOp, evalUidt as UITypes, showNullAndEmptyInFilter),
  )?.value

  if (isDateType(evalUidt) && !['blank', 'notblank'].includes(filter.comparison_op!)) {
    if (filter.comparison_op === 'isWithin') {
      filter.comparison_sub_op = 'pastNumberOfDays'
    } else {
      filter.comparison_sub_op = 'exactDate'
    }
  } else {
    // reset
    filter.comparison_sub_op = null
  }
}

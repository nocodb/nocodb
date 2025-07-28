import {
  ClientType,
  SqlUiFactory,
  UITypes,
  getEquivalentUIType,
  isDateMonthFormat,
  isNumericCol,
  isSystemColumn,
  isVirtualCol,
  numericUITypes,
} from 'nocodb-sdk'
import type {
  Api,
  type ColumnType,
  type FilterType,
  type LinkToAnotherRecordType,
  type LookupType,
  type TableType,
} from 'nocodb-sdk'

export const MAX_NESTED_LEVEL = 5
export const excludedFilterColUidt = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

export interface ComparisonOpUiType {
  text: string
  value: string
  ignoreVal: boolean
  includedTypes?: UITypes[]
  excludedTypes?: UITypes[]
}

export interface FilterGroupChangeEvent {
  filters: ColumnFilterType[]
  filter: ColumnFilterType | null
  type: 'row_changed' | 'add' | 'delete'
  parentFilter?: ColumnFilterType
  fk_parent_id?: string
  prevValue?: any
  value: any
  index: number
}

export interface FilterRowChangeEvent {
  filter: ColumnFilterType
  type:
    | 'logical_op'
    | 'fk_column_id'
    | 'fk_value_col_id'
    | 'comparison_op'
    | 'comparison_sub_op'
    | 'value'
    | 'dynamic'
    | 'child_add'
    | 'child_delete'
  prevValue: any
  value: any
  index: number
}

export type ColumnTypeForFilter = ColumnType & {
  btLookupColumn?: ColumnTypeForFilter
  filterUidt?: UITypes
}

export function isDateType(uidt: UITypes) {
  return [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(uidt)
}

const getEqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '='
  } else if (
    [
      UITypes.SingleSelect,
      UITypes.Collaborator,
      UITypes.LinkToAnotherRecord,
      UITypes.Date,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.DateTime,
    ].includes(fieldUiType)
  ) {
    return 'is'
  }
  return 'is equal'
}

const getNeqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '!='
  } else if (
    [
      UITypes.SingleSelect,
      UITypes.Collaborator,
      UITypes.LinkToAnotherRecord,
      UITypes.Date,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.DateTime,
    ].includes(fieldUiType)
  ) {
    return 'is not'
  }
  return 'is not equal'
}

const getLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return 'filenames contain'
  }
  return 'is like'
}

const getNotLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return "filenames don't contain"
  }
  return 'is not like'
}

const getGtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is after'
  }
  return '>'
}

const getLtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is before'
  }
  return '<'
}

const getGteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is on or after'
  }
  return '>='
}

const getLteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is on or before'
  }
  return '<='
}

export const comparisonOpList = (
  fieldUiType: UITypes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateFormat?: string,
): ComparisonOpUiType[] => [
  {
    text: 'is checked',
    value: 'checked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
  },
  {
    text: 'is not checked',
    value: 'notchecked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
  },
  {
    text: getEqText(fieldUiType),
    value: 'eq',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.MultiSelect,
      UITypes.Attachment,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
  },
  {
    text: getNeqText(fieldUiType),
    value: 'neq',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.MultiSelect,
      UITypes.Attachment,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
  },
  {
    text: getLikeText(fieldUiType),
    value: 'like',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: getNotLikeText(fieldUiType),
    value: 'nlike',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: 'is empty',
    value: 'empty',
    ignoreVal: true,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: 'is not empty',
    value: 'notempty',
    ignoreVal: true,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: 'is null',
    value: 'null',
    ignoreVal: true,
    excludedTypes: [
      ...numericUITypes,
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
    ],
  },
  {
    text: 'is not null',
    value: 'notnull',
    ignoreVal: true,
    excludedTypes: [
      ...numericUITypes,
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
    ],
  },
  {
    text: 'contains all of',
    value: 'allof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'contains any of',
    value: 'anyof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'does not contain all of',
    value: 'nallof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'does not contain any of',
    value: 'nanyof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: getGtText(fieldUiType),
    value: 'gt',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getLtText(fieldUiType),
    value: 'lt',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getGteText(fieldUiType),
    value: 'gte',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getLteText(fieldUiType),
    value: 'lte',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.Time,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ],
  },
  {
    text: 'is within',
    value: 'isWithin',
    ignoreVal: true,
    includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
  },
  {
    text: 'is blank',
    value: 'blank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
  },
  {
    text: 'is not blank',
    value: 'notblank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
  },
]

export const comparisonSubOpList = (
  // TODO: type
  comparison_op: string,
  dateFormat?: string,
): ComparisonOpUiType[] => {
  const isDateMonth = dateFormat && isDateMonthFormat(dateFormat)

  if (comparison_op === 'isWithin') {
    return [
      {
        text: 'the past week',
        value: 'pastWeek',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past month',
        value: 'pastMonth',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past year',
        value: 'pastYear',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next week',
        value: 'nextWeek',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next month',
        value: 'nextMonth',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next year',
        value: 'nextYear',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next number of days',
        value: 'nextNumberOfDays',
        ignoreVal: false,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past number of days',
        value: 'pastNumberOfDays',
        ignoreVal: false,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
    ]
  }
  return [
    {
      text: 'today',
      value: 'today',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'tomorrow',
      value: 'tomorrow',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'yesterday',
      value: 'yesterday',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one week ago',
      value: 'oneWeekAgo',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one week from now',
      value: 'oneWeekFromNow',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one month ago',
      value: 'oneMonthAgo',
      ignoreVal: true,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
    {
      text: 'one month from now',
      value: 'oneMonthFromNow',
      ignoreVal: true,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
    {
      text: 'number of days ago',
      value: 'daysAgo',
      ignoreVal: false,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'number of days from now',
      value: 'daysFromNow',
      ignoreVal: false,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: isDateMonth ? 'exact month' : 'exact date',
      value: 'exactDate',
      ignoreVal: false,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
  ]
}

export const getPlaceholderNewRow = (
  filters: Filter[],
  columns: ColumnType[],
  option?: {
    currentUser?: {
      email: string
      id: string
    }
  },
) => {
  if (filters.some((filter) => filter.logical_op === 'or')) {
    return {}
  }
  const placeholderNewRow: Record<string, any> = {}
  for (const eachFilter of filters) {
    if (['checked', 'notchecked', 'allof', 'eq'].includes(eachFilter.comparison_op as any)) {
      const column = columns.find((col) => col.id === eachFilter.fk_column_id)
      if (column) {
        if (
          [
            UITypes.Number,
            UITypes.Decimal,
            UITypes.SingleLineText,
            UITypes.LongText,
            UITypes.SingleSelect,
            UITypes.GeoData,
            UITypes.Email,
            UITypes.PhoneNumber,
            UITypes.URL,
            UITypes.Time,
            UITypes.Year,
            UITypes.Currency,
            UITypes.Percent,
            UITypes.Rating,
            UITypes.Duration,
            UITypes.JSON,

            // User is using allOf and anyOf so we cannot include it here
            // UITypes.User,
          ].includes(column.uidt as UITypes) ||
          ([UITypes.Date, UITypes.DateTime].includes(column.uidt as UITypes) && eachFilter.comparison_sub_op === 'exactDate')
        ) {
          placeholderNewRow[column.title!] = eachFilter.value
        } else if (
          [UITypes.Checkbox].includes(column.uidt as UITypes) &&
          ['checked', 'notchecked'].includes(eachFilter.comparison_op as any)
        ) {
          placeholderNewRow[column.title!] = eachFilter.comparison_op === 'checked'
        } else if ([UITypes.MultiSelect].includes(column.uidt as UITypes) && ['allof'].includes(eachFilter.comparison_op)) {
          placeholderNewRow[column.title!] = eachFilter.value
        } else if ([UITypes.User].includes(column.uidt as UITypes) && ['allof'].includes(eachFilter.comparison_op)) {
          const isMulti = parseProp(column.meta)?.is_multi
          if (isMulti || eachFilter.value?.indexOf?.(',') < 0) {
            const assignedValue = eachFilter.value
              .split(',')
              .map((k) => (k === '@me' ? option?.currentUser?.id : k))
              .filter((k) => k)
              .join(',')
            placeholderNewRow[column.title!] = assignedValue
          }
        }
      }
    }
  }
  return placeholderNewRow
}

export const isComparisonOpAllowed = (
  filter: ColumnFilterType,
  compOp: {
    text: string
    value: string
    ignoreVal?: boolean
    includedTypes?: UITypes[]
    excludedTypes?: UITypes[]
  },
  uidt?: UITypes,
  showNullAndEmptyInFilter?: boolean,
) => {
  const isNullOrEmptyOp = ['empty', 'notempty', 'null', 'notnull'].includes(compOp.value)

  if (compOp.includedTypes) {
    // include allowed values only if selected column type matches
    if (filter.fk_column_id && compOp.includedTypes.includes(uidt!)) {
      // for 'empty', 'notempty', 'null', 'notnull',
      // show them based on `showNullAndEmptyInFilter` in Base Settings
      return isNullOrEmptyOp ? showNullAndEmptyInFilter : true
    } else {
      return false
    }
  } else if (compOp.excludedTypes) {
    // include not allowed values only if selected column type not matches
    if (filter.fk_column_id && !compOp.excludedTypes.includes(uidt!)) {
      // for 'empty', 'notempty', 'null', 'notnull',
      // show them based on `showNullAndEmptyInFilter` in Base Settings
      return isNullOrEmptyOp ? showNullAndEmptyInFilter : true
    } else {
      return false
    }
  }
  // explicitly include for non-null / non-empty ops
  return isNullOrEmptyOp ? showNullAndEmptyInFilter : true
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

export const getFilterCount = (filters: FilterType[]) => {
  let result = 0
  for (const filter of filters) {
    if (filter.is_group) {
      result += getFilterCount(filter.children ?? [])
    } else {
      result += 1
    }
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

export const deleteFilterWithSub = async ($api: Api<unknown>, filter: FilterType) => {
  let result: string[] = []
  if (filter.is_group && filter.children?.length > 0) {
    for (const child of filter.children) {
      result = [...result, ...(await deleteFilterWithSub($api, child))]
    }
  }
  await $api.dbTableFilter.delete(filter.id)
  result.push(filter.id)
  return result
}

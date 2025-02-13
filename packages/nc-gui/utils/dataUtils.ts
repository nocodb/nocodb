import {
  RelationTypes,
  UITypes,
  buildFilterTree,
  dateFormats,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isDateMonthFormat,
  isSystemColumn,
  isVirtualCol,
  timeFormats,
} from 'nocodb-sdk'
import type {
  AIRecordType,
  ButtonType,
  ColumnType,
  FilterType,
  LinkToAnotherRecordType,
  LookupType,
  RollupType,
  TableType,
} from 'nocodb-sdk'
import dayjs from 'dayjs'
import { isColumnRequiredAndNull } from './columnUtils'

export const isValidValue = (val: unknown) => {
  if (ncIsNull(val) || ncIsUndefined(val)) {
    return false
  }

  if (ncIsString(val) && val === '') {
    return false
  }

  if (ncIsEmptyArray(val)) {
    return false
  }

  if (ncIsEmptyObject(val)) {
    return false
  }

  return true
}

export const extractPkFromRow = (row: Record<string, any>, columns: ColumnType[]) => {
  if (!row || !columns) return null

  const pkCols = columns.filter((c: Required<ColumnType>) => c.pk)
  // if multiple pk columns, join them with ___ and escape _ in id values with \_ to avoid conflicts
  if (pkCols.length > 1) {
    return pkCols.map((c: Required<ColumnType>) => row?.[c.title]?.toString?.().replaceAll('_', '\\_') ?? null).join('___')
  } else if (pkCols.length) {
    const id = row?.[pkCols[0].title] ?? null
    return id === null ? null : `${id}`
  }
}

export const rowPkData = (row: Record<string, any>, columns: ColumnType[]) => {
  const pkData: Record<string, string> = {}
  const pks = columns?.filter((c) => c.pk)
  if (row && pks && pks.length) {
    for (const pk of pks) {
      if (pk.title) pkData[pk.title] = row[pk.title]
    }
  }
  return pkData
}

export const extractPk = (columns: ColumnType[]) => {
  if (!columns && !Array.isArray(columns)) return null
  return columns
    .filter((c) => c.pk)
    .map((c) => c.title)
    .join('___')
}

export const findIndexByPk = (pk: Record<string, string>, data: Row[]) => {
  for (const [i, row] of Object.entries(data)) {
    if (Object.keys(pk).every((k) => pk[k] === row.row[k])) {
      return parseInt(i)
    }
  }
  return -1
}

// a function to populate insert object and verify if all required fields are present
export async function populateInsertObject({
  getMeta,
  row,
  meta,
  ltarState,
  throwError,
  undo = false,
}: {
  meta: TableType
  ltarState: Record<string, any>
  getMeta: (tableIdOrTitle: string, force?: boolean) => Promise<TableType | null>
  row: Record<string, any>
  throwError?: boolean
  undo?: boolean
}) {
  const missingRequiredColumns = new Set()
  const insertObj = await meta.columns?.reduce(async (_o: Promise<any>, col) => {
    const o = await _o

    // if column is BT relation then check if foreign key is not_null(required)
    if (
      ltarState &&
      col.uidt === UITypes.LinkToAnotherRecord &&
      (<LinkToAnotherRecordType>col.colOptions).type === RelationTypes.BELONGS_TO
    ) {
      if (ltarState[col.title!] || row[col.title!]) {
        const ltarVal = ltarState[col.title!] || row[col.title!]
        const colOpt = <LinkToAnotherRecordType>col.colOptions
        const childCol = meta.columns!.find((c) => colOpt.fk_child_column_id === c.id)
        const relatedTableMeta = (await getMeta(colOpt.fk_related_model_id!)) as TableType
        if (relatedTableMeta && childCol) {
          o[childCol.title!] = ltarVal[relatedTableMeta!.columns!.find((c) => c.id === colOpt.fk_parent_column_id)!.title!]
          if (o[childCol.title!] !== null && o[childCol.title!] !== undefined) missingRequiredColumns.delete(childCol.title)
        }
      }
    }
    // check all the required columns are not null
    if (isColumnRequiredAndNull(col, row)) {
      missingRequiredColumns.add(col.title)
    }

    if ((!col.ai || undo) && row?.[col.title as string] !== null) {
      o[col.title as string] = row?.[col.title as string]
    }

    return o
  }, Promise.resolve({}))

  if (throwError && missingRequiredColumns.size) {
    throw new Error(`Missing required columns: ${[...missingRequiredColumns].join(', ')}`)
  }

  return { missingRequiredColumns, insertObj }
}

// a function to get default values of row
export const rowDefaultData = (columns: ColumnType[] = []) => {
  const defaultData: Record<string, string> = columns.reduce<Record<string, any>>((acc: Record<string, any>, col: ColumnType) => {
    //  avoid setting default value for system col, virtual col, rollup, formula, barcode, qrcode, links, ltar
    if (
      !isSystemColumn(col) &&
      !isVirtualCol(col) &&
      ![UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.Barcode, UITypes.QrCode].includes(col.uidt) &&
      isValidValue(col?.cdf) &&
      !/^\w+\(\)|CURRENT_TIMESTAMP$/.test(col.cdf)
    ) {
      const defaultValue = col.cdf
      acc[col.title!] = typeof defaultValue === 'string' ? defaultValue.replace(/^'|'$/g, '') : defaultValue
    }
    return acc
  }, {} as Record<string, any>)

  return defaultData
}

export const isRowEmpty = (record: Pick<Row, 'row'>, col: ColumnType): boolean => {
  if (!record || !col || !col.title) return true

  return !isValidValue(record.row[col.title])
}

export function validateRowFilters(_filters: FilterType[], data: any, columns: ColumnType[], client: any) {
  if (!_filters.length) {
    return true
  }

  const filters = buildFilterTree(_filters)

  let isValid = null
  for (const filter of filters) {
    let res
    if (filter.is_group && filter.children?.length) {
      res = validateRowFilters(filter.children, data, columns, client)
    } else {
      const column = columns.find((c) => c.id === filter.fk_column_id)
      if (!column) {
        continue
      }
      const field = column.title!
      let val = data[field]
      if (
        [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(column.uidt!) &&
        !['empty', 'blank', 'notempty', 'notblank'].includes(filter.comparison_op!)
      ) {
        const dateFormat = client === 'mysql2' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

        let now = dayjs(new Date())
        const dateFormatFromMeta = column?.meta?.date_format
        const dataVal: any = val
        let filterVal: any = filter.value
        if (dateFormatFromMeta && isDateMonthFormat(dateFormatFromMeta)) {
          // reset to 1st
          now = dayjs(now).date(1)
          if (val) val = dayjs(val).date(1)
        }
        if (filterVal) res = dayjs(filterVal).isSame(dataVal, 'day')

        // handle sub operation
        switch (filter.comparison_sub_op) {
          case 'today':
            filterVal = now
            break
          case 'tomorrow':
            filterVal = now.add(1, 'day')
            break
          case 'yesterday':
            filterVal = now.add(-1, 'day')
            break
          case 'oneWeekAgo':
            filterVal = now.add(-1, 'week')
            break
          case 'oneWeekFromNow':
            filterVal = now.add(1, 'week')
            break
          case 'oneMonthAgo':
            filterVal = now.add(-1, 'month')
            break
          case 'oneMonthFromNow':
            filterVal = now.add(1, 'month')
            break
          case 'daysAgo':
            if (!filterVal) return
            filterVal = now.add(-filterVal, 'day')
            break
          case 'daysFromNow':
            if (!filterVal) return
            filterVal = now.add(filterVal, 'day')
            break
          case 'exactDate':
            if (!filterVal) return
            break
          // sub-ops for `isWithin` comparison
          case 'pastWeek':
            filterVal = now.add(-1, 'week')
            break
          case 'pastMonth':
            filterVal = now.add(-1, 'month')
            break
          case 'pastYear':
            filterVal = now.add(-1, 'year')
            break
          case 'nextWeek':
            filterVal = now.add(1, 'week')
            break
          case 'nextMonth':
            filterVal = now.add(1, 'month')
            break
          case 'nextYear':
            filterVal = now.add(1, 'year')
            break
          case 'pastNumberOfDays':
            if (!filterVal) return
            filterVal = now.add(-filterVal, 'day')
            break
          case 'nextNumberOfDays':
            if (!filterVal) return
            filterVal = now.add(filterVal, 'day')
            break
        }

        if (dataVal) {
          switch (filter.comparison_op) {
            case 'eq':
              res = dayjs(dataVal).isSame(filterVal, 'day')
              break
            case 'neq':
              res = !dayjs(dataVal).isSame(filterVal, 'day')
              break
            case 'gt':
              res = dayjs(dataVal).isAfter(filterVal, 'day')
              break
            case 'lt':
              res = dayjs(dataVal).isBefore(filterVal, 'day')
              break
            case 'lte':
            case 'le':
              res = dayjs(dataVal).isSameOrBefore(filterVal, 'day')
              break
            case 'gte':
            case 'ge':
              res = dayjs(dataVal).isSameOrAfter(filterVal, 'day')
              break
            case 'empty':
            case 'blank':
              res = dataVal === '' || dataVal === null || dataVal === undefined
              break
            case 'notempty':
            case 'notblank':
              res = !(dataVal === '' || dataVal === null || dataVal === undefined)
              break
            case 'isWithin': {
              let now = dayjs(new Date()).format(dateFormat).toString()
              now = column.uidt === UITypes.Date ? now.substring(0, 10) : now
              switch (filter.comparison_sub_op) {
                case 'pastWeek':
                case 'pastMonth':
                case 'pastYear':
                case 'pastNumberOfDays':
                  res = dayjs(dataVal).isBetween(filterVal, now, 'day')
                  break
                case 'nextWeek':
                case 'nextMonth':
                case 'nextYear':
                case 'nextNumberOfDays':
                  res = dayjs(dataVal).isBetween(now, filterVal, 'day')
                  break
              }
            }
          }
        }
      } else {
        switch (typeof filter.value) {
          case 'boolean':
            val = !!data[field]
            break
          case 'number':
            val = +data[field]
            break
        }

        if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(column.uidt!)) {
          const userIds: string[] = Array.isArray(data[field])
            ? data[field].map((user) => user.id)
            : data[field]?.id
            ? [data[field].id]
            : []

          const filterValues = (filter.value?.split(',') || []).map((v) => v.trim())

          switch (filter.comparison_op) {
            case 'anyof':
              res = userIds.some((id) => filterValues.includes(id))
              break
            case 'nanyof':
              res = !userIds.some((id) => filterValues.includes(id))
              break
            case 'allof':
              res = filterValues.every((id) => userIds.includes(id))
              break
            case 'nallof':
              res = !filterValues.every((id) => userIds.includes(id))
              break
            case 'empty':
            case 'blank':
              res = userIds.length === 0
              break
            case 'notempty':
            case 'notblank':
              res = userIds.length > 0
              break
            default:
              res = false // Unsupported operation for User fields
          }
        } else {
          switch (filter.comparison_op) {
            case 'eq':
              // eslint-disable-next-line eqeqeq
              res = val == filter.value
              break
            case 'neq':
              // eslint-disable-next-line eqeqeq
              res = val != filter.value
              break
            case 'like':
              res = data[field]?.toString?.()?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) > -1
              break
            case 'nlike':
              res = data[field]?.toString?.()?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) === -1
              break
            case 'empty':
            case 'blank':
              res = data[field] === '' || data[field] === null || data[field] === undefined
              break
            case 'notempty':
            case 'notblank':
              res = !(data[field] === '' || data[field] === null || data[field] === undefined)
              break
            case 'checked':
              res = !!data[field]
              break
            case 'notchecked':
              res = !data[field]
              break
            case 'null':
              res = res = data[field] === null
              break
            case 'notnull':
              res = data[field] !== null
              break
            case 'allof':
              res = (filter.value?.split(',').map((item) => item.trim()) ?? []).every((item) =>
                (data[field]?.split(',') ?? []).includes(item),
              )
              break
            case 'anyof':
              res = (filter.value?.split(',').map((item) => item.trim()) ?? []).some((item) =>
                (data[field]?.split(',') ?? []).includes(item),
              )
              break
            case 'nallof':
              res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).every((item) =>
                (data[field]?.split(',') ?? []).includes(item),
              )
              break
            case 'nanyof':
              res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).some((item) =>
                (data[field]?.split(',') ?? []).includes(item),
              )
              break
            case 'lt':
              res = +data[field] < +filter.value
              break
            case 'lte':
            case 'le':
              res = +data[field] <= +filter.value
              break
            case 'gt':
              res = +data[field] > +filter.value
              break
            case 'gte':
            case 'ge':
              res = +data[field] >= +filter.value
              break
          }
        }
      }
    }

    switch (filter.logical_op) {
      case 'or':
        isValid = isValid || !!res
        break
      case 'not':
        isValid = isValid && !res
        break
      case 'and':
      default:
        isValid = (isValid ?? true) && res
        break
    }
  }
  return isValid
}

export const isAllowToRenderRowEmptyField = (col: ColumnType) => {
  if (!col) return false

  if (isAI(col)) {
    return true
  }

  if (isAiButton(col)) {
    return true
  }

  return false
}

// Plain cell value
export const getCheckBoxValue = (modelValue: boolean | string | number | '0' | '1') => {
  return !!modelValue && modelValue !== '0' && modelValue !== 0 && modelValue !== 'false'
}

export const getMultiSelectValue = (modelValue: any, params: ParsePlainCellValueProps['params']): string => {
  const { col, isMysql } = params

  if (!modelValue) {
    return ''
  }

  return modelValue
    ? Array.isArray(modelValue)
      ? modelValue.join(', ')
      : modelValue.toString()
    : isMysql(col.source_id)
    ? modelValue.toString().split(',').join(', ')
    : modelValue.split(', ')
}

export const getDateValue = (modelValue: string | null | number, col: ColumnType, isSystemCol?: boolean) => {
  const dateFormat = !isSystemCol ? parseProp(col.meta)?.date_format ?? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ss'

  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  } else {
    return dayjs(/^\d+$/.test(String(modelValue)) ? +modelValue : modelValue).format(dateFormat)
  }
}

export const getYearValue = (modelValue: string | null) => {
  if (!modelValue) {
    return ''
  } else if (!dayjs(modelValue).isValid()) {
    return ''
  } else {
    return dayjs(modelValue.toString(), 'YYYY').format('YYYY')
  }
}

export const getDateTimeValue = (modelValue: string | null, params: ParsePlainCellValueProps['params']) => {
  const { col, isMssql, isXcdbBase } = params

  if (!modelValue || !dayjs(modelValue).isValid()) {
    return ''
  }

  const dateFormat = parseProp(col?.meta)?.date_format ?? dateFormats[0]
  const timeFormat = parseProp(col?.meta)?.time_format ?? timeFormats[0]
  const dateTimeFormat = `${dateFormat} ${timeFormat}`

  const isXcDB = isXcdbBase(col.source_id)

  if (!isXcDB) {
    return dayjs(/^\d+$/.test(modelValue) ? +modelValue : modelValue).format(dateTimeFormat)
  }

  if (isMssql(col.source_id)) {
    // e.g. 2023-04-29T11:41:53.000Z
    return dayjs(modelValue, dateTimeFormat).format(dateTimeFormat)
  } else {
    return dayjs(modelValue).utc().local().format(dateTimeFormat)
  }
}

export const getTimeValue = (modelValue: string | null, col: ColumnType) => {
  const timeFormat = parseProp(col?.meta)?.is12hrFormat ? 'hh:mm A' : 'HH:mm'

  if (!modelValue) {
    return ''
  }
  let time = dayjs(modelValue)

  if (!time.isValid()) {
    time = dayjs(modelValue, 'HH:mm:ss')
  }
  if (!time.isValid()) {
    time = dayjs(`1999-01-01 ${modelValue}`)
  }
  if (!time.isValid()) {
    return ''
  }

  return time.format(timeFormat)
}

export const getDurationValue = (modelValue: string | null, col: ColumnType) => {
  const durationType = parseProp(col.meta)?.duration || 0
  return convertMS2Duration(modelValue, durationType)
}

export const getPercentValue = (modelValue: string | null) => {
  return modelValue ? `${modelValue}%` : ''
}

export const getCurrencyValue = (modelValue: string | number | null | undefined, col: ColumnType): string => {
  const currencyMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
    ...parseProp(col.meta),
  }

  try {
    if (modelValue === null || modelValue === undefined || isNaN(modelValue)) {
      return modelValue === null || modelValue === undefined ? '' : (modelValue as string)
    }
    return new Intl.NumberFormat(currencyMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: currencyMeta.currency_code || 'USD',
    }).format(+modelValue)
  } catch (e) {
    return modelValue as string
  }
}

export const getUserValue = (modelValue: string | string[] | null | Array<any>, params: ParsePlainCellValueProps['params']) => {
  const { meta, baseUsers: baseUsersMap = new Map() } = params
  if (!modelValue) {
    return ''
  }
  const baseUsers = meta?.base_id ? baseUsersMap.get(meta?.base_id) || [] : []

  if (typeof modelValue === 'string') {
    const idsOrMails = modelValue.split(',')

    return idsOrMails
      .map((idOrMail) => {
        const user = baseUsers.find((u) => u.id === idOrMail || u.email === idOrMail)
        return user ? user.display_name || user.email : idOrMail.id
      })
      .join(', ')
  } else {
    if (Array.isArray(modelValue)) {
      return modelValue
        .map((idOrMail) => {
          const user = baseUsers.find((u) => u.id === idOrMail.id || u.email === idOrMail.email)
          return user ? user.display_name || user.email : idOrMail.id
        })
        .join(', ')
    } else {
      return modelValue ? modelValue.display_name || modelValue.email : ''
    }
  }
}

export const getDecimalValue = (modelValue: string | null | number, col: ColumnType) => {
  if (!modelValue || isNaN(Number(modelValue))) {
    return ''
  }
  const columnMeta = parseProp(col.meta)

  return Number(modelValue).toFixed(columnMeta?.precision ?? 1)
}

export const getIntValue = (modelValue: string | null | number) => {
  if (!modelValue || isNaN(Number(modelValue))) {
    return ''
  }
  return Number(modelValue) as unknown as string
}

export const getTextAreaValue = (modelValue: string | null, col: ColumnType) => {
  const isRichMode = parseProp(col.meta).richMode
  if (isRichMode) {
    return modelValue?.replace(/[*_~\[\]]|<\/?[^>]+(>|$)/g, '') || ''
  }

  if (isAIPromptCol(col)) {
    return (modelValue as AIRecordType)?.value || ''
  }

  return modelValue || ''
}

export const getRollupValue = (modelValue: string | null | number, params: ParsePlainCellValueProps['params']) => {
  const { col, meta, metas } = params

  const colOptions = col.colOptions as RollupType

  const fns = ['count', 'avg', 'sum', 'countDistinct', 'sumDistinct', 'avgDistinct']
  if (fns.includes(colOptions.rollup_function!)) {
    return modelValue as string
  } else {
    const relationColumnOptions = colOptions.fk_relation_column_id
      ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)?.colOptions
      : null
    const relatedTableMeta =
      relationColumnOptions?.fk_related_model_id && metas?.[relationColumnOptions.fk_related_model_id as string]

    const childColumn = relatedTableMeta?.columns.find((c: ColumnType) => c.id === colOptions.fk_rollup_column_id)

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return parsePlainCellValue(modelValue, { ...params, col: childColumn }) as string
  }
}

export const getLookupValue = (modelValue: string | null | number | Array<any>, params: ParsePlainCellValueProps['params']) => {
  const { col, meta, metas } = params

  const colOptions = col.colOptions as LookupType
  const relationColumnOptions = colOptions.fk_relation_column_id
    ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)?.colOptions
    : null
  const relatedTableMeta =
    relationColumnOptions?.fk_related_model_id && metas?.[relationColumnOptions.fk_related_model_id as string]

  const childColumn = relatedTableMeta?.columns.find((c: ColumnType) => c.id === colOptions.fk_lookup_column_id) as
    | ColumnType
    | undefined

  if (Array.isArray(modelValue)) {
    return modelValue
      .map((v) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return parsePlainCellValue(v, { ...params, col: childColumn! })
      })
      .join(', ')
  }
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return parsePlainCellValue(modelValue, { ...params, col: childColumn! })
}

export const getAttachmentValue = (modelValue: string | null | number | Array<any>) => {
  if (Array.isArray(modelValue)) {
    return modelValue.map((v) => `${v.title}`).join(', ')
  }
  return modelValue as string
}

export const getLinksValue = (modelValue: string, params: ParsePlainCellValueProps['params']) => {
  const { col, t } = params

  if (typeof col.meta === 'string') {
    col.meta = JSON.parse(col.meta)
  }

  const parsedValue = +modelValue || 0
  if (!parsedValue) {
    return ''
  } else if (parsedValue === 1) {
    return `1 ${col?.meta?.singular || t('general.link')}`
  } else {
    return `${parsedValue} ${col?.meta?.plural || t('general.links')}`
  }
}

export const parsePlainCellValue = (
  value: ParsePlainCellValueProps['value'],
  params: ParsePlainCellValueProps['params'],
): string => {
  const { col, abstractType, isUnderLookup } = params

  if (!col) {
    return ''
  }
  if (isGeoData(col)) {
    const [latitude, longitude] = ((value as string) || '').split(';')
    return latitude && longitude ? `${latitude}; ${longitude}` : value
  }
  if (isTextArea(col)) {
    return getTextAreaValue(value, col)
  }
  if (isBoolean(col, abstractType)) {
    return getCheckBoxValue(value) ? 'Checked' : 'Unchecked'
  }
  if (isMultiSelect(col)) {
    return getMultiSelectValue(value, params)
  }
  if (isDate(col, abstractType)) {
    return getDateValue(value, col)
  }
  if (isYear(col, abstractType)) {
    return getYearValue(value)
  }
  if (isDateTime(col, abstractType)) {
    return getDateTimeValue(value, params)
  }
  if (isTime(col, abstractType)) {
    return getTimeValue(value, col)
  }
  if (isDuration(col)) {
    return getDurationValue(value, col)
  }
  if (isPercent(col)) {
    return getPercentValue(value)
  }
  if (isCurrency(col)) {
    return getCurrencyValue(value, col)
  }
  if (isUser(col)) {
    return getUserValue(value, params)
  }
  if (isDecimal(col)) {
    return getDecimalValue(value, col)
  }
  if (isInt(col, abstractType)) {
    return getIntValue(value)
  }
  if (isJSON(col)) {
    try {
      if (isUnderLookup) {
        return typeof value === 'string' ? value : JSON.stringify(value)
      } else {
        return JSON.stringify(JSON.parse(value), null, 2)
      }
    } catch {
      return value
    }
  }
  if (isRollup(col)) {
    return getRollupValue(value, params)
  }
  if (isLookup(col) || isLTAR(col.uidt, col.colOptions)) {
    return getLookupValue(value, params)
  }
  if (isCreatedOrLastModifiedTimeCol(col)) {
    return getDateValue(value, col, true)
  }
  if (isCreatedOrLastModifiedByCol(col)) {
    return getUserValue(value, params)
  }
  if (isAttachment(col)) {
    return getAttachmentValue(value)
  }
  if (isLink(col)) {
    return getLinksValue(value, col)
  }

  if (isFormula(col) && col?.meta?.display_type) {
    const childColumn = {
      uidt: col?.meta?.display_type,
      ...col?.meta?.display_column_meta,
    }
    return parsePlainCellValue(value, { ...params, col: childColumn })
  }

  if (isButton(col)) {
    if ((col.colOptions as ButtonType).type === 'url') return value
    else return col.colOptions?.label
  }

  return value as unknown as string
}

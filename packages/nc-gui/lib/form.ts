import type { ColumnType } from 'ant-design-vue/lib/table'
import dayjs from 'dayjs'
import { type FilterType, type LinkToAnotherRecordType, type TableType, UITypes, isDateMonthFormat } from 'nocodb-sdk'

type FormViewColumn = ColumnType & Record<string, any>

export class FormFilters {
  allViewFilters: FilterType[]
  protected groupedFilters: Record<string, FilterType[]>
  nestedGroupedFilters: Record<string, FilterType[]>
  formViewColumns: FormViewColumn[]
  formViewColumnsMapByFkColumnId: Record<string, FormViewColumn>
  formState: Record<string, any>
  value: any
  isSharedForm: boolean
  isMysql?: (sourceId?: string) => boolean
  getMeta?: (tableIdOrTitle: string) => Promise<TableType | null>

  constructor({
    data = [],
    nestedGroupedFilters = {},
    formViewColumns = [],
    formViewColumnsMapByFkColumnId = {},
    formState = {},
    isMysql = undefined,
    isSharedForm = false,
    getMeta = undefined,
  }: {
    data?: FilterType[]
    nestedGroupedFilters?: Record<string, FilterType[]>
    formViewColumns?: FormViewColumn[]
    formViewColumnsMapByFkColumnId?: Record<string, FormViewColumn>
    formState?: Record<string, any>
    isMysql?: (sourceId?: string) => boolean
    isSharedForm?: boolean
    getMeta?: (tableIdOrTitle: string) => Promise<TableType | null>
  } = {}) {
    this.allViewFilters = data
    this.groupedFilters = {}
    this.nestedGroupedFilters = nestedGroupedFilters
    this.formViewColumns = formViewColumns
    this.formViewColumnsMapByFkColumnId = formViewColumnsMapByFkColumnId
    this.formState = formState
    this.isSharedForm = isSharedForm
    this.isMysql = isMysql
    this.getMeta = getMeta
  }

  setFilters(filters: FilterType[]) {
    this.allViewFilters = filters
  }

  getRootFilters(parentColId: string) {
    return (this.groupedFilters[parentColId] || [])
      .filter((f) => !f.fk_parent_id)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }

  getParentFilters(parentColId: string, parentId: string) {
    return (this.groupedFilters[parentColId] || [])
      .filter((f) => f.fk_parent_id === parentId)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }

  getAllChildFilters(filters: FilterType[], parentColId: string): any {
    return filters.map((filter) => {
      if (filter.id && filter.is_group) {
        const childFilters = this.getParentFilters(parentColId, filter.id)
        filter.children = this.getAllChildFilters(childFilters, parentColId)
      }

      return filter
    })
  }

  loadFilters() {
    for (const parentColId in this.groupedFilters) {
      const rootFilters = this.getRootFilters(parentColId)

      this.nestedGroupedFilters[parentColId] = this.getAllChildFilters(rootFilters, parentColId)
    }
    return this.nestedGroupedFilters
  }

  // Method to group filters by fk_parent_column_id
  getNestedGroupedFilters() {
    const groupedFilters = this.allViewFilters.reduce((acc, filter) => {
      const groupingKey = filter.fk_parent_column_id || 'ungrouped'

      if (!acc[groupingKey]) {
        acc[groupingKey] = []
      }

      acc[groupingKey].push(filter)

      return acc
    }, {} as typeof this.groupedFilters)

    this.groupedFilters = groupedFilters

    const nestedGroupedFilters = this.loadFilters()

    return nestedGroupedFilters
  }

  toString(value: any) {
    return `${value || ''}`
  }

  isFieldAboveParentColumn(column: FormViewColumn, parentColumn: FormViewColumn) {
    return column.order < parentColumn.order
  }

  async getOoOrBtColVal(column: FormViewColumn) {
    const fk_related_model_id = (column?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id

    if (!fk_related_model_id || typeof this.getMeta !== 'function') return null

    const relatedTableMeta = await this.getMeta(fk_related_model_id)

    if (!relatedTableMeta || !Array.isArray(relatedTableMeta?.columns)) return null

    const displayValTitle = (relatedTableMeta.columns.find((c) => c.pv) || relatedTableMeta.columns?.[0])?.title || ''

    if (
      !displayValTitle ||
      !this.formState[column.title] ||
      !ncIsObject(this.formState[column.title]) ||
      this.formState[column.title][displayValTitle] === undefined
    ) {
      return null
    }

    return this.formState[column.title][displayValTitle]
  }

  async validateCondition(
    filters: FilterType[] = [],
    parentCol: FormViewColumn,
    errors: Record<string, string>,
  ): Promise<boolean | undefined> {
    if (!filters.length) {
      return true
    }

    let isValid

    for (const filter of filters) {
      let res

      if (filter.is_group) {
        res = await this.validateCondition(filter.children, parentCol, errors)
      } else {
        if (!filter.fk_column_id || !this.formViewColumnsMapByFkColumnId[filter.fk_column_id]) {
          res = false
        }

        const column = this.formViewColumnsMapByFkColumnId[filter.fk_column_id]
        // If the filter condition col is below parent column then this will be invalid condition so return false
        if (!this.isFieldAboveParentColumn(column, parentCol)) {
          errors[column.fk_column_id] = `Condition references a field (${column.title}) that comes later in the form.`
          res = true
        }

        if (!column.show) {
          errors[column.fk_column_id] = `Condition references a field (${column.title}) that was removed from the form.`

          res = true
        }

        if (!column?.visible) {
          res = false
        }

        const field = column.title

        let val = this.formState[field]

        if (res === undefined) {
          if (
            [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(column.uidt) &&
            !['empty', 'blank', 'notempty', 'notblank'].includes(filter.comparison_op)
          ) {
            const dateFormat = this.isMysql?.(column.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

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
                val = !!this.formState[field]
                break
              case 'number':
                val = Number.isNaN(parseFloat(this.formState[field])) ? this.formState[field] : +this.formState[field]
                break
            }

            switch (column.uidt) {
              case UITypes.Links:
                if (isMm(column) || isHm(column)) {
                  val = (this.formState[field] ?? []).length
                }
                break
              case UITypes.LinkToAnotherRecord:
                if (isOo(column) || isBt(column)) {
                  val = await this.getOoOrBtColVal(column)
                }
                break
            }

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
                res = this.toString(val).toLowerCase()?.includes(filter.value?.toLowerCase())
                break
              case 'nlike':
                res = !this.toString(val).toLowerCase()?.includes(filter.value?.toLowerCase())
                break
              case 'empty':
              case 'blank':
                res = val === '' || val === null || val === undefined
                break
              case 'notempty':
              case 'notblank':
                res = !(val === '' || val === null || val === undefined)
                break
              case 'checked':
                res = !!val
                break
              case 'notchecked':
                res = !val
                break
              case 'null':
                res = val === null
                break
              case 'notnull':
                res = val !== null
                break
              case 'allof':
                res = (
                  this.toString(filter.value)
                    .split(',')
                    .map((item) => item.trim()) ?? []
                ).every((item) => (this.toString(val).split(',') ?? []).includes(item))
                break
              case 'anyof':
                res = (
                  this.toString(filter.value)
                    .split(',')
                    .map((item) => item.trim()) ?? []
                ).some((item) => (this.toString(val).split(',') ?? []).includes(item))
                break
              case 'nallof':
                res = !(
                  this.toString(filter.value)
                    .split(',')
                    .map((item) => item.trim()) ?? []
                ).every((item) => (this.toString(val).split(',') ?? []).includes(item))
                break
              case 'nanyof':
                res = !(
                  this.toString(filter.value)
                    .split(',')
                    .map((item) => item.trim()) ?? []
                ).some((item) => (this.toString(val).split(',') ?? []).includes(item))
                break
              case 'lt':
                res = parseFloat(val) < +filter.value
                break
              case 'lte':
              case 'le':
                res = parseFloat(val) <= +filter.value
                break
              case 'gt':
                res = parseFloat(val) > +filter.value
                break
              case 'gte':
              case 'ge':
                res = parseFloat(val) >= +filter.value
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

  async validateVisibility() {
    const res: Record<string, boolean> = {}

    for (const column of this.formViewColumns) {
      const columnFilters = this.nestedGroupedFilters[column.fk_column_id] ?? []

      const errors: Record<string, string> = {}

      const isValid = await this.validateCondition(columnFilters, column, errors)

      if (this.isSharedForm) {
        if (!column.meta?.preFilledHiddenField) {
          column.show = !!isValid
          column.visible = !!isValid
        }
      } else {
        column.visible = !!isValid

        column.meta = {
          ...parseProp(column.meta),
          visibility: {
            errors,
          },
        }
      }
    }

    return res
  }

  validateErrors() {}
}

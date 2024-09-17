import type { ColumnType } from 'ant-design-vue/lib/table'
import dayjs from 'dayjs'
import { isDateMonthFormat, UITypes, type FilterType, type TableType } from 'nocodb-sdk'

type FormViewColumn = ColumnType & Record<string, any>

export class Filter {
  allViewFilters: FilterType[]
  protected groupedFilters: Record<string, FilterType[]>
  nestedGroupedFilters: Record<string, FilterType[]>
  meta?: TableType
  formViewColumns: FormViewColumn[]
  formViewColumnsMapByFkColumnId: Record<string, FormViewColumn>
  formState: Record<string, any>
  value: any
  activeFieldFilters: FilterType[]
  isMysql?: (sourceId?: string) => boolean

  constructor(
    data: FilterType[] = [],
    nestedGroupedFilters = {},
    meta = undefined,
    formViewColumns = [],
    formViewColumnsMapByFkColumnId = {},
    formState = {},
    isMysql = undefined,
  ) {
    this.allViewFilters = data
    this.groupedFilters = {}
    this.nestedGroupedFilters = nestedGroupedFilters
    this.meta = meta
    this.formViewColumns = formViewColumns
    this.formViewColumnsMapByFkColumnId = formViewColumnsMapByFkColumnId
    this.formState = formState
    this.activeFieldFilters = []
    this.isMysql = isMysql
  }

  get length(): number {
    return this.allViewFilters.length
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
    const groupedFiltes = this.allViewFilters.reduce((acc, filter) => {
      const groupingKey = filter.fk_parent_column_id || 'ungrouped'

      if (!acc[groupingKey]) {
        acc[groupingKey] = []
      }

      acc[groupingKey].push(filter)

      return acc
    }, {} as typeof this.groupedFilters)

    this.groupedFilters = groupedFiltes

    const nestedGroupedFilters = this.loadFilters()

    return nestedGroupedFilters
  }

  isFieldAboveParentColumn(column: FormViewColumn, parentColumn: FormViewColumn) {
    return column.order < parentColumn.order
  }

  validateCondition(filters: FilterType[] = [], parentCol: FormViewColumn, errors: Record<string, string>): boolean {
    if (!filters.length) {
      return true
    }

    let isValid

    for (const filter of filters) {
      let res

      if (filter.is_group) {
        res = this.validateCondition(filter.children, parentCol, errors)
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
                val = +this.formState[field]
                break
            }

            switch (filter.comparison_op) {
              case 'eq':
                res = val == filter.value
                break
              case 'neq':
                res = val != filter.value
                break
              case 'like':
                res = this.formState[field]?.toString?.()?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) > -1
                break
              case 'nlike':
                res = this.formState[field]?.toString?.()?.toLowerCase()?.indexOf(filter.value?.toLowerCase()) === -1
                break
              case 'empty':
              case 'blank':
                res = this.formState[field] === '' || this.formState[field] === null || this.formState[field] === undefined
                break
              case 'notempty':
              case 'notblank':
                res = !(this.formState[field] === '' || this.formState[field] === null || this.formState[field] === undefined)
                break
              case 'checked':
                res = !!this.formState[field]
                break
              case 'notchecked':
                res = !this.formState[field]
                break
              case 'null':
                res = res = this.formState[field] === null
                break
              case 'notnull':
                res = this.formState[field] !== null
                break
              case 'allof':
                res = (filter.value?.split(',').map((item) => item.trim()) ?? []).every((item) =>
                  (this.formState[field]?.split(',') ?? []).includes(item),
                )
                break
              case 'anyof':
                res = (filter.value?.split(',').map((item) => item.trim()) ?? []).some((item) =>
                  (this.formState[field]?.split(',') ?? []).includes(item),
                )
                break
              case 'nallof':
                res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).every((item) =>
                  (this.formState[field]?.split(',') ?? []).includes(item),
                )
                break
              case 'nanyof':
                res = !(filter.value?.split(',').map((item) => item.trim()) ?? []).some((item) =>
                  (this.formState[field]?.split(',') ?? []).includes(item),
                )
                break
              case 'lt':
                res = +this.formState[field] < +filter.value
                break
              case 'lte':
              case 'le':
                res = +this.formState[field] <= +filter.value
                break
              case 'gt':
                res = +this.formState[field] > +filter.value
                break
              case 'gte':
              case 'ge':
                res = +this.formState[field] >= +filter.value
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

  validateVisibility() {
    const res: Record<string, boolean> = {}

    for (const column of this.formViewColumns) {
      const columnFilters = this.nestedGroupedFilters[column.fk_column_id] ?? []

      const errors: Record<string, string> = {}

      const isValid = this.validateCondition(columnFilters, column, errors)

      column.visible = !!isValid

      column.meta = {
        ...parseProp(column.meta),
        visibility: {
          errors,
        },
      }
    }

    return res
  }

  validateErrors() {}
}

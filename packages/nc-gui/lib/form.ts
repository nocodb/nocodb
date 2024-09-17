import type { ColumnType } from 'ant-design-vue/lib/table'
import { type FilterType } from 'nocodb-sdk'

type FormViewColumn = ColumnType & Record<string, any>

export class FormFilters {
  allViewFilters: FilterType[]
  protected groupedFilters: Record<string, FilterType[]>
  nestedGroupedFilters: Record<string, FilterType[]>
  formViewColumns: FormViewColumn[]
  formViewColumnsMapByFkColumnId: Record<string, FormViewColumn>
  formState: Record<string, any>
  value: any
  isMysql?: (sourceId?: string) => boolean

  constructor({
    data = [],
    nestedGroupedFilters = {},
    formViewColumns = [],
    formViewColumnsMapByFkColumnId = {},
    formState = {},
    isMysql = undefined,
  }: {
    data?: FilterType[]
    nestedGroupedFilters?: Record<string, FilterType[]>
    formViewColumns?: FormViewColumn[]
    formViewColumnsMapByFkColumnId?: Record<string, FormViewColumn>
    formState?: Record<string, any>
    isMysql?: (sourceId?: string) => boolean
  } = {}) {
    this.allViewFilters = data
    this.groupedFilters = {}
    this.nestedGroupedFilters = nestedGroupedFilters
    this.formViewColumns = formViewColumns
    this.formViewColumnsMapByFkColumnId = formViewColumnsMapByFkColumnId
    this.formState = formState
    this.isMysql = isMysql
  }

  setFilters(filters: FilterType[]) {
    this.allViewFilters = filters
  }

  getNestedGroupedFilters() {}

  validateVisibility() {}
}

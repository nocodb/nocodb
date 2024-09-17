import type { ColumnType } from 'ant-design-vue/lib/table'
import { type FilterType, type TableType } from 'nocodb-sdk'

type FormViewColumn = ColumnType & Record<string, any>

export class FormFilters {
  allViewFilters: FilterType[]
  protected groupedFilters: Record<string, FilterType[]>
  nestedGroupedFilters: Record<string, FilterType[]>
  meta?: TableType
  formViewColumns: FormViewColumn[]
  formViewColumnsMapByFkColumnId: Record<string, FormViewColumn>
  formState: Record<string, any>
  value: any
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
    this.isMysql = isMysql
  }

  setFilters(filters: FilterType[]) {
    this.allViewFilters = filters
  }

  getNestedGroupedFilters() {}

  validateVisibility() {}
}

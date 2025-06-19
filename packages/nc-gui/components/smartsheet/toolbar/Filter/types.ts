import type { ClientType } from 'nocodb-sdk'

export interface RowHandler {
  rowChange?: (event: FilterRowChangeEvent) => Promise<void>
}

export interface GroupHandler extends RowHandler {
  addFilter?: () => Promise<void>
  addFilterGroup?: () => Promise<void>
  deleteFilter?: () => Promise<void>
}

export interface StatefulGroupProps {
  modelValue: ColumnFilterType[]
  disableAddNewFilter?: boolean
  actionBtnType?: 'text' | 'secondary'

  webHook?: boolean
  link?: boolean
  isForm?: boolean
  isPublic?: boolean
  isFullWidth?: boolean

  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean

  // what's this???
  queryFilter?: boolean

  handler?: GroupHandler
}
export interface GroupProps extends StatefulGroupProps {
  index: number
  fk_parent_id?: string
  nestedLevel: number
  columns: ColumnTypeForFilter[]
  dbClientType?: ClientType
  showNullAndEmptyInFilter?: boolean
  isLogicalOpChangeAllowed?: boolean
  // limit imposed by user plan
  filterPerViewLimit: number
  // total filter already added into section
  filtersCount?: number
}
export interface GroupEmits {
  (event: 'update:modelValue', model: string): void
  (event: 'change', model: FilterGroupChangeEvent): void
  (event: 'row-change', model: FilterRowChangeEvent): void
  (
    event: 'delete',
    model: {
      filter: ColumnFilterType[]
      index: number
    },
  ): void
}

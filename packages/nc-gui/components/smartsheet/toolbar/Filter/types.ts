import type { ClientType } from 'nocodb-sdk'

export interface StatefulGroupProps {
  modelValue: ColumnFilterType[]
  disableAddNewFilter?: boolean
  actionBtnType?: 'text' | 'secondary'

  webHook?: boolean
  link?: boolean
  isForm?: boolean
  isPublic?: boolean

  disabled?: boolean
  // some view is different when locked view but not disabled
  isLockedView?: boolean

  // what's this???
  queryFilter?: boolean
}
export interface GroupProps extends StatefulGroupProps {
  index: number
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

import type { RowColoringMode } from 'nocodb-sdk'

export interface RowColorSingleSelectOption {
  isSetAsBackground: false
  fk_column_id: ''
}
export interface RowColorFilterType {
  color: string
  is_group: boolean
  id?: string
  children: ColumnFilterType[]
  isSetAsBackground: false
}

export interface RowColorConfig {
  fk_model_id: string
  rowColoringMode?: RowColoringMode
  singleSelectOption?: RowColorSingleSelectOption
  filters?: RowColorFilterType[]
}
export const useRowColorHelper = (config: globalThis.Ref<RowColorConfig>) => {
  
}

import { DefaultOptionType } from 'ant-design-vue/es/vc-select/Select'

export type NSelectMode = 'multiple' | 'tags'
export type NSelectSize = 'small' | 'middle' | 'large'
export type NSelectOption = DefaultOptionType

export interface NSelectProps {
  modelValue?: string | string[]
  placeholder?: string
  mode?: NSelectMode
  size?: NSelectSize

  options?: NSelectOption[]

  showSearch?: boolean
  allowClear?: boolean
  loading?: boolean
  disabled?: boolean
  suffixIcon?: ValidIcon

  filterOption?: (input: string, option: any) => boolean

  /** Dropdown Params */
  dropdownClassOverride?: string
  dropdownMatchSelectWidth?: boolean
}

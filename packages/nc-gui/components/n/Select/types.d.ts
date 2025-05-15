import type { DefaultOptionType } from 'ant-design-vue/lib/vc-select/Select'
import type { SelectValue } from 'ant-design-vue/lib/select'

export type NSelectMode = 'multiple' | 'tags'
export type NSelectSize = 'small' | 'middle' | 'large'
export type NSelectOption = DefaultOptionType

export interface NSelectProps {
  modelValue?: SelectValue
  placeholder?: string
  mode?: NSelectMode
  size?: NSelectSize

  options?: NSelectOption[]

  showSearch?: boolean
  allowClear?: boolean
  loading?: boolean
  disabled?: boolean
  suffixIcon?: IconMapKey

  filterOption?: (input: string, option: any) => boolean

  /** Dropdown Params */
  dropdownClassOverride?: string
  dropdownMatchSelectWidth?: boolean
}

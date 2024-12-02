export type SelectMode = 'multiple' | 'tags'
export type SelectSize = 'small' | 'middle' | 'large'

export interface SelectProps {
  modelValue?: string | string[]
  placeholder?: string
  mode?: SelectMode
  size?: SelectSize
  
  showSearch?: boolean
  allowClear?: boolean
  loading?: boolean
  suffixIcon?: ValidIcon

  filterOption?: (input: string, option: any) => boolean

  /** Dropdown Params */
  dropdownClassOverride?: string
  dropdownMatchSelectWidth?: boolean
}
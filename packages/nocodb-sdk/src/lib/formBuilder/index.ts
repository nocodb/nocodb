export enum FormBuilderInputType {
  Input = 'input',
  Select = 'select',
  Switch = 'switch',
  Space = 'space',
  Password = 'password',
}

export interface FormBuilderElement {
  // element type
  type: FormBuilderInputType
  // property path in the form JSON
  model?: string
  // default value
  defaultValue?: string
  // label for the element
  label?: string
  // placeholder for the element (if applicable)
  placeholder?: string
  // percentage width of the element
  width?: number
  // category of the element - same category elements are grouped together
  category?: string
  // help text for the element
  // options for select element
  options?: { value: string; label: string }[]
  // select mode for the element (if applicable) - default is single
  selectMode?: 'single' | 'multiple' | 'multipleWithInput'
  // border for the element (if applicable) - default is false
  border?: boolean
  // show hint as tooltip for the element (if applicable) - default is false
  showHintAsTooltip?: boolean
  // validators for the element
  validators?: { type: 'required'; message?: string; }[]
}

export type FormDefinition = FormBuilderElement[]

export const FORM_BUILDER_NON_CATEGORIZED = 'form-builder-non-categorized'

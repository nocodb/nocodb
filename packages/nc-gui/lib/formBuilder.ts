export enum FormBuilderInputType {
  Input = 'input',
  Select = 'select',
  Switch = 'switch',
  Space = 'space',
  Password = 'password',
}

export interface FormBuilderElement {
  type: FormBuilderInputType
  model?: string
  defaultValue?: string
  label?: string
  placeholder?: string
  width?: number
  category?: string
  helpText?: string
  required?: boolean
  // used for select type
  options?: { value: string; label: string }[]
  // used for styling switch
  border?: boolean
  showHintAsTooltip?: boolean
}

export type FormDefinition = FormBuilderElement[]

export const FORM_BUILDER_NON_CATEGORIZED = 'form-builder-non-categorized'

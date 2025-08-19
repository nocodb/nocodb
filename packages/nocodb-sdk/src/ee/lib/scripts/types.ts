export interface ScriptConfigItemBase {
    type: 'table' | 'field' | 'view' | 'text' | 'number' | 'select'
    key: string
    label?: string
    description?: string
}

export interface ScriptConfigItemTable extends ScriptConfigItemBase {
    type: 'table'
}

export interface ScriptConfigItemField extends ScriptConfigItemBase {
    type: 'field'
    parentTable: string
}

export interface ScriptConfigItemView extends ScriptConfigItemBase {
    type: 'view'
    parentTable: string
}

export interface ScriptConfigItemSelect extends ScriptConfigItemBase {
    type: 'select'
    options: Array<{ value: string; label?: string }>
}

export interface ScriptConfigItemNumber extends ScriptConfigItemBase {
    type: 'number'
}

export interface ScriptConfigItemText extends ScriptConfigItemBase {
    type: 'text'
}

export type ScriptConfigItem =
    | ScriptConfigItemTable
    | ScriptConfigItemField
    | ScriptConfigItemView
    | ScriptConfigItemSelect
    | ScriptConfigItemNumber
    | ScriptConfigItemText

export interface ScriptConfig {
    title: string
    description?: string
    items: ScriptConfigItem[]
}


export  interface InputCallInfo {
  type: string // Method name like 'textAsync', 'selectAsync', etc.
  line: number
  column: number
  start: number
  end: number
  arguments?: any[] // Parsed arguments if needed
}

export interface CursorRowUsage {
  line: number
  column: number
  start: number
  end: number
  context: 'property' | 'method' // Whether it's cursor.row.something or just cursor.row
  property?: string // If it's cursor.row.fieldName, this would be 'fieldName'
}
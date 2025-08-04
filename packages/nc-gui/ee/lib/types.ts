import type { ScriptActionType, ScriptInputType, ScriptViewActionType } from '~/lib/enum'
import type { IconMapKey } from '~/utils/iconUtils'

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export interface BaseAction<T extends ScriptActionType, P> {
  type: T
  payload: P
}

export interface BaseViewActionPayload {
  id: string
  action: ScriptViewActionType
}

export interface ReloadViewPayload extends BaseViewActionPayload {
  action: ScriptViewActionType.RELOAD_VIEW
}

export interface ReloadRowPayload extends BaseViewActionPayload {
  action: ScriptViewActionType.RELOAD_ROW
  rowId: string
}

export type ViewActionPayload = Prettify<ReloadViewPayload | ReloadRowPayload>

export interface CallApiAction
  extends BaseAction<
    ScriptActionType.CALL_API,
    {
      id: string
      method: string
      args: unknown[]
    }
  > {}

export interface ScriptInputButtonOption<T = any> {
  label: string
  value: T
  variant?: 'default' | 'primary' | 'secondary' | 'danger'
}

export interface ScriptInputSelectOption<T = any> {
  label: string
  value: T
}

export interface ScriptInputFileUploadResult {
  file: File
  parsedContents: any
}

// Base input content interface
interface ScriptBaseInputContent {
  label?: string
}

// Text input content
export interface ScriptTextInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.TEXT
}

// Select input content
export interface ScriptSelectInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.SELECT
  options: ScriptInputSelectOption[]
}

// Buttons input content
export interface ScriptButtonsInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.BUTTONS
  options: ScriptInputButtonOption[]
}

export interface ScriptFileInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.FILE
  accept?: string
  hasHeaderRow?: boolean
  useRawValues?: boolean
}

// Table input content
export interface ScriptTableInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.TABLE
}

// View input content
export interface ScriptViewInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.VIEW
  tableId: string
}

// Field input content
export interface ScriptFieldInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.FIELD
  tableId: string
}

// Record input content
export interface ScriptRecordInputContent extends ScriptBaseInputContent {
  type: ScriptInputType.RECORD
  tableId?: string
  viewId?: string
  records?: Record<string, any>[]
  options: {
    fields?: string[]
  }
}

export type InputContent =
  | ScriptTextInputContent
  | ScriptSelectInputContent
  | ScriptButtonsInputContent
  | ScriptFileInputContent
  | ScriptTableInputContent
  | ScriptViewInputContent
  | ScriptFieldInputContent
  | ScriptRecordInputContent

// Playground item types
export interface ScriptTextPlaygroundItem {
  type: 'text'
  content: string
  style?: 'log' | 'error' | 'warning'
}

export interface ScriptMarkdownPlaygroundItem {
  type: 'markdown'
  content: string
}

export interface ScriptTablePlaygroundItem {
  type: 'table'
  content: any[] | object
}

export interface ScriptInspectPlaygroundItem {
  type: 'inspect'
  content: any
}

export interface ScriptInputRequestPlaygroundItem {
  type: 'input-request'
  content: InputContent
  id: string
  resolve: (value: string | Record<string, any> | ScriptInputFileUploadResult) => void
}

// Union type for all playground items
export type ScriptPlaygroundItem =
  | ScriptTextPlaygroundItem
  | ScriptMarkdownPlaygroundItem
  | ScriptTablePlaygroundItem
  | ScriptInspectPlaygroundItem
  | ScriptInputRequestPlaygroundItem
  | WorkflowStepItem

export interface WorkflowStepItem {
  type: 'workflow-step'
  content: {
    title: string
    description?: string
    color: string
    icon?: IconMapKey
    children: ScriptPlaygroundItem[]
  }
}

export interface DynamicInputProps {
  content: InputContent
  onResolve: (value: string | Record<string, any> | ScriptInputFileUploadResult) => void
}

export {
  ScriptConfigItemBase,
  ScriptConfigItemTable,
  ScriptConfigItemField,
  ScriptConfigItemView,
  ScriptConfigItemSelect,
  ScriptConfigItemNumber,
  ScriptConfigItemText,
  ScriptConfigItem,
  ScriptConfig,
} from 'nocodb-sdk'

export * from '../../lib/types'

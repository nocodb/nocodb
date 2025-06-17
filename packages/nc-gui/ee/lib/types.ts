import type { type ScriptActionType, ScriptViewActionType } from '~/lib/enum'

export interface ScriptConfigItem {
  type: 'table' | 'field' | 'view' | 'text' | 'number' | 'select'
  key: string
  label?: string
  description?: string
  parentTable?: string
  options?: Array<{ value: string; label?: string }>
}

export interface ScriptConfig {
  title: string
  description?: string
  items: ScriptConfigItem[]
}

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

export interface ScriptPlaygroundItem {
  type: string
  content: any
  style?: string
  id?: string
  resolve?: (value: string) => void
}

export * from '../../lib/types'

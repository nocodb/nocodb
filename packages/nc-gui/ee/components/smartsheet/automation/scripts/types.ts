export enum ActionType {
  LOG = 'log',
  ERROR = 'error',
  WARN = 'warn',
  OUTPUT = 'output',
  CALL_API = 'callApi',
  RESPONSE = 'response',
  DONE = 'done',
  INPUT = 'input',
  INPUT_RESOLVED = 'inputResolved',
  UPDATE_PROGRESS = 'updateProgress',
  RESET_PROGRESS = 'resetProgress',
  REMOTE_FETCH = 'remoteFetch',

  ACTION = 'action',
  ACTION_COMPLETE = 'action_complete',
}

type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export enum ViewActionType {
  RELOAD_VIEW = 'reloadView',
  RELOAD_ROW = 'reloadRow',
}

// Base Action Type
interface BaseAction<T extends ActionType, P> {
  type: T
  payload: P
}

// Input Types
export const InputType = {
  TEXT: 'text',
  SELECT: 'select',
  FILE: 'file',
  BUTTONS: 'buttons',
  VIEW: 'view',
  TABLE: 'table',
  FIELD: 'field',
  RECORD: 'record',
} as const

// View Action Payload Types
interface BaseViewActionPayload {
  id: string
  action: ViewActionType
}

export interface ReloadViewPayload extends BaseViewActionPayload {
  action: ViewActionType.RELOAD_VIEW
}

export interface ReloadRowPayload extends BaseViewActionPayload {
  action: ViewActionType.RELOAD_ROW
  rowId: string
}

export type ViewActionPayload = Prettify<ReloadViewPayload | ReloadRowPayload>

export interface CallApiAction
  extends BaseAction<
    ActionType.CALL_API,
    {
      id: string
      method: string
      args: unknown[]
    }
  > {}

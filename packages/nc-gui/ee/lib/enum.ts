export enum ScriptActionType {
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
export enum ScriptViewActionType {
  RELOAD_VIEW = 'reloadView',
  RELOAD_ROW = 'reloadRow',
}

export const ScriptInputType = {
  TEXT: 'text',
  SELECT: 'select',
  FILE: 'file',
  BUTTONS: 'buttons',
  VIEW: 'view',
  TABLE: 'table',
  FIELD: 'field',
  RECORD: 'record',
} as const

export * from '../../lib/enums'

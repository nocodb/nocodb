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

  WORKFLOW_STEP_START = 'workflowStepStart',
  WORKFLOW_STEP_END = 'workflowStepEnd',

  RECORD_UPDATE_START = 'recordUpdateStart',
  RECORD_UPDATE_COMPLETE = 'recordUpdateComplete',
}
export enum ScriptViewActionType {
  RELOAD_VIEW = 'reloadView',
  RELOAD_ROW = 'reloadRow',
}

export enum ScriptInputType {
  TEXT = 'text',
  SELECT = 'select',
  FILE = 'file',
  BUTTONS = 'buttons',
  VIEW = 'view',
  TABLE = 'table',
  FIELD = 'field',
  RECORD = 'record',
}

export * from '../../lib/enums'

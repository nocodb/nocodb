import { ViewLockType } from 'nocodb-sdk'

export { ClientType, IntegrationCategoryType, SyncDataType } from 'nocodb-sdk'

export enum Language {
  ar = 'العربية',
  bn_IN = 'বাংলা',
  cs = 'Czech',
  da = 'Dansk',
  de = 'Deutsch',
  en = 'English',
  es = 'Español',
  eu = 'Basque',
  fa = 'فارسی',
  fi = 'Suomalainen',
  fr = 'Français',
  he = 'עברית',
  hi = 'हिन्दी',
  hr = 'Hrvatski',
  hu = 'Magyar',
  id = 'Bahasa Indonesia',
  it = 'Italiano',
  ja = '日本語',
  kn = 'ಕನ್ನಡ',
  ko = '한국어',
  lv = 'Latviešu',
  ml = 'മലയാളം',
  nl = 'Nederlandse',
  no = 'Norsk',
  pl = 'Polski',
  pt = 'Português',
  pt_BR = 'Português (Brasil)',
  ru = 'Pусский',
  sk = 'Slovenčina',
  sl = 'Slovenščina',
  sv = 'Svenska',
  th = 'ไทย',
  tr = 'Türk',
  uk = 'Українська',
  vi = 'Tiếng Việt',
  'zh-Hans' = '简体中文',
  'zh-Hant' = '繁體中文',
}

export enum LanguageAlias {
  zh_CN = 'zh-Hans',
  zh_TW = 'zh-Hant',
}

export enum NavigateDir {
  NEXT,
  PREV,
}

export { ViewLockType as LockType }

export enum TabType {
  TABLE = 'table',
  VIEW = 'view',
  AUTH = 'auth',
  SQL = 'sql',
  ERD = 'erd',
  DOCUMENT = 'doc',
  LAYOUT = 'layout',
  DB = 'db',
}

export enum SmartsheetStoreEvents {
  SORT_RELOAD = 'sort-reload',
  FILTER_RELOAD = 'filter-reload',
  GROUP_BY_RELOAD = 'group-by-reload',
  DATA_RELOAD = 'data-reload',
  FIELD_RELOAD = 'field-reload',
  FIELD_ADD = 'field-add',
  MAPPED_BY_COLUMN_CHANGE = 'mapped-by-column-change',
  CLEAR_NEW_ROW = 'clear-new-row',
  GROUP_BY_ADD = 'group-by-add',
  GROUP_BY_REMOVE = 'group-by-remove',
  FILTER_ADD = 'filter-add',
  CELL_SELECTED = 'cell-selected',
}

export enum SmartsheetScriptActions {
  UPDATE_PROGRESS = 'update-progress',
  RESET_PROGRESS = 'reset-progress',
  ACTION = 'action',

  RELOAD_VIEW = 'reload-view',
  RELOAD_ROW = 'reload-row',
}

export enum DataSourcesSubTab {
  New = 'New',
  Metadata = 'Metadata',
  ERD = 'ERD',
  UIAcl = 'UI ACL',
  Audit = 'Audit',
  Misc = 'Misc',
  Edit = 'Edit',
}

export enum AutomationLogLevel {
  OFF = 'OFF',
  ERROR = 'ERROR',
  ALL = 'ALL',
}

export enum JobStatus {
  COMPLETED = 'completed',
  WAITING = 'waiting',
  ACTIVE = 'active',
  DELAYED = 'delayed',
  FAILED = 'failed',
  PAUSED = 'paused',
  REFRESH = 'refresh',
}

export enum ImportWorkerOperations {
  PROCESS = 'process',
  SET_TABLES = 'setTables',
  SET_CONFIG = 'setConfig',
  GET_SINGLE_SELECT_OPTIONS = 'getSingleSelectOptions',
  GET_MULTI_SELECT_OPTIONS = 'getMultiSelectOptions',
  INIT_SDK = 'initSDK',
}

export enum ImportWorkerResponse {
  PROCESSED_DATA = 'processedData',
  PROGRESS = 'progress',
  SINGLE_SELECT_OPTIONS = 'singleSelectOptions',
  MULTI_SELECT_OPTIONS = 'multiSelectOptions',
  ERROR = 'error',
}

export enum ImportType {
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

export enum ImportSource {
  FILE = 'file',
  URL = 'url',
  STRING = 'string',
}

export enum PreFilledMode {
  Default = 'default',
  Hidden = 'hidden',
  Locked = 'locked',
}

export enum RichTextBubbleMenuOptions {
  bold = 'bold',
  italic = 'italic',
  underline = 'underline',
  strike = 'strike',
  code = 'code',
  quote = 'quote',
  heading1 = 'heading1',
  heading2 = 'heading2',
  heading3 = 'heading3',
  blockQuote = 'blockQuote',
  bulletList = 'bulletList',
  numberedList = 'numberedList',
  taskList = 'taskList',
  link = 'link',
}

export enum CoverImageObjectFit {
  FIT = 'fit',
  COVER = 'cover',
}

export enum AuditLogsDateRange {
  Last24H = 'last24H',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth',
  PastYear = 'pastYear',
  Custom = 'custom',
}

export enum ExtensionsEvents {
  ADD = 'add',
  DUPLICATE = 'duplicate',
  CLEARDATA = 'clearData',
}

export enum IntegrationStoreEvents {
  INTEGRATION_ADD = 'integration-add',
}

export enum WorkspaceIconType {
  IMAGE = 'IMAGE',
  EMOJI = 'EMOJI',
  ICON = 'ICON',
}

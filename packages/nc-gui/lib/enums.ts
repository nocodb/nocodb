export enum ClientType {
  MYSQL = 'mysql2',
  MSSQL = 'mssql',
  PG = 'pg',
  SQLITE = 'sqlite3',
  VITESS = 'vitess',
  SNOWFLAKE = 'snowflake',
}

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
  he = 'עִברִית',
  hi = 'हिन्दी',
  hr = 'Hrvatski',
  id = 'Bahasa Indonesia',
  it = 'Italiano',
  ja = '日本語',
  ko = '한국인',
  lv = 'Latviešu',
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
  zn_CN = 'zh-Hans',
  zh_TW = 'zh-Hant',
}

export enum NavigateDir {
  NEXT,
  PREV,
}

export enum LockType {
  Personal = 'personal',
  Locked = 'locked',
  Collaborative = 'collaborative',
}

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

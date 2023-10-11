export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const EMPTY_TITLE_PLACEHOLDER_DOCS = 'Untitled'

export const MAX_WIDTH_FOR_MOBILE_MODE = 480

export const BASE_FALLBACK_URL = process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080'

export const GROUP_BY_VARS = {
  NULL: '__nc_null__',
  TRUE: '__nc_true__',
  FALSE: '__nc_false__',
  VAR_TITLES: {
    __nc_null__: 'Empty',
    __nc_true__: 'Checked',
    __nc_false__: 'Unchecked',
  } as Record<string, string>,
}

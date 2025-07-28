import { NO_SCOPE as SDK_NO_SCOPE } from 'nocodb-sdk'

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
    __nc_null__: '(Empty)',
    __nc_true__: 'Checked',
    __nc_false__: 'Unchecked',
  } as Record<string, string>,
}

export const INITIAL_LEFT_SIDEBAR_WIDTH = 288

export const NO_SCOPE = SDK_NO_SCOPE

export const ANT_MESSAGE_DURATION = +(process.env.ANT_MESSAGE_DURATION ?? (ncIsPlaywright() ? 1 : 6))

export const EXTERNAL_SOURCE_TOTAL_ROWS = 200

export const EXTERNAL_SOURCE_VISIBLE_ROWS = 100

export const MINI_SIDEBAR_WIDTH = 48

export const clientMousePositionDefaultValue = { clientX: 0, clientY: 0 }

export const CHART_COLORS = [
  '#2ec7c9',
  '#b6a2de',
  '#5ab1ef',
  '#ffb980',
  '#d87a80',
  '#8d98b3',
  '#e5cf0d',
  '#97b552',
  '#95706d',
  '#dc69aa',
  '#07a2a4',
  '#9a7fd1',
  '#588dd5',
  '#f5994e',
  '#c05050',
  '#59678c',
  '#c9ab00',
  '#7eb00a',
  '#6f5553',
  '#c14089',
]

import { NO_SCOPE as SDK_NO_SCOPE } from 'nocodb-sdk'

export const NOCO = 'noco'

export const SYSTEM_COLUMNS = ['id', 'title', 'created_at', 'updated_at']

export const EMPTY_TITLE_PLACEHOLDER_DOCS = 'Untitled'

/**
 * Shared breakpoint definitions (min-width px values).
 * Used by both WindiCSS screens config and useBreakpoints() in JS.
 * `xs` is excluded — it's the default (< sm) and a max-width alias in WindiCSS.
 */
export const NC_BREAKPOINTS = {
  'sm': 480,
  'md': 820,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1780,
  '3xl': 1920,
  '4xl': 2560,
  '5xl': 3200,
} as const

export const MAX_WIDTH_FOR_MOBILE_MODE = NC_BREAKPOINTS.sm

export type NcBreakpoint = 'xs' | keyof typeof NC_BREAKPOINTS

/**
 * WindiCSS screen definitions derived from NC_BREAKPOINTS.
 * `xs` is max-width (mobile-only), all others are min-width.
 */
export const NC_SCREEN_BREAKPOINTS = {
  'xs': { max: `${NC_BREAKPOINTS.sm}px` },
  'sm': { min: `${NC_BREAKPOINTS.sm}px` },
  'md': { min: `${NC_BREAKPOINTS.md}px` },
  'lg': { min: `${NC_BREAKPOINTS.lg}px` },
  'xl': { min: `${NC_BREAKPOINTS.xl}px` },
  '2xl': { min: `${NC_BREAKPOINTS['2xl']}px` },
  '3xl': { min: `${NC_BREAKPOINTS['3xl']}px` },
  '4xl': { min: `${NC_BREAKPOINTS['4xl']}px` },
  '5xl': { min: `${NC_BREAKPOINTS['5xl']}px` },
}

export const BASE_FALLBACK_URL = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:8080'

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

export const NEW_MINI_SIDEBAR_WIDTH = 64

export const NC_CLOUD_URL = 'https://app.nocodb.com'

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

/** Virtual section ID for views not assigned to any real section */
export const DEFAULT_SECTION_ID = '__default__'

export const showWsSettingsInBase = false

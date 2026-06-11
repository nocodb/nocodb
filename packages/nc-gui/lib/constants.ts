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

// Curated palettes keyed by the chart appearance.colorSchema enum value.
// 'default' is the NocoDB brand palette (current product default).
// 'custom' is reserved — when wired, it consumes appearance.customColorSchema.
export const CHART_PALETTES: Record<string, string[]> = {
  default: [
    '#3366FF',
    '#36BFFF',
    '#22C7C9',
    '#22C55E',
    '#FFCD56',
    '#FFA94D',
    '#FF6B6B',
    '#FF6B9D',
    '#B388EB',
    '#7C8FFF',
    '#94A3B8',
    '#67E8F9',
  ],
  classic: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#9C755F', '#FF9DA7', '#BAB0AC'],
  vibrant: ['#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#EF4444', '#14B8A6', '#A855F7', '#F97316', '#22D3EE'],
  pastel: ['#A5B4FC', '#FCA5A5', '#FCD34D', '#86EFAC', '#67E8F9', '#F9A8D4', '#FDBA74', '#C4B5FD', '#FECACA', '#BBF7D0'],
  earth: ['#8B4513', '#CD853F', '#DAA520', '#6B8E23', '#A0522D', '#D2691E', '#BC8F8F', '#556B2F', '#8FBC8F', '#B8860B'],
  monoBlue: ['#0B2D7A', '#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
}

// `value` is the colorSchema enum value (also the i18n key suffix under
// labels.chartPalette.*). Components resolve the display label via t().
export const CHART_PALETTE_OPTIONS = [
  { value: 'default', colors: CHART_PALETTES.default },
  { value: 'classic', colors: CHART_PALETTES.classic },
  { value: 'vibrant', colors: CHART_PALETTES.vibrant },
  { value: 'pastel', colors: CHART_PALETTES.pastel },
  { value: 'earth', colors: CHART_PALETTES.earth },
  { value: 'monoBlue', colors: CHART_PALETTES.monoBlue },
]

export const getChartColors = (schema?: string | null): string[] => {
  return CHART_PALETTES[schema ?? 'default'] ?? CHART_PALETTES.default!
}

// Legacy named export kept for any remaining consumer; resolves to the
// default (brand) palette. New chart code reads getChartColors(appearance.colorSchema).
export const CHART_COLORS = CHART_PALETTES.default!

/** Virtual section ID for views not assigned to any real section */
export const DEFAULT_SECTION_ID = '__default__'

export const showWsSettingsInBase = false

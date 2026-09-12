import { NO_SCOPE as SDK_NO_SCOPE } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'

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

// Cap the number of toasts shown at once. Without this, a burst of errors (e.g.
// a config mismatch failing many dependent fields) stacks unbounded and sweeps
// the screen. Ant removes the oldest once the cap is exceeded.
export const ANT_MESSAGE_MAX_COUNT = +(process.env.ANT_MESSAGE_MAX_COUNT ?? 5)

export const EXTERNAL_SOURCE_TOTAL_ROWS = 200

export const EXTERNAL_SOURCE_VISIBLE_ROWS = 100

export const MINI_SIDEBAR_WIDTH = 48

export const NEW_MINI_SIDEBAR_WIDTH = 64

export const NC_CLOUD_URL = 'https://app.nocodb.com'

export const clientMousePositionDefaultValue = { clientX: 0, clientY: 0 }

// Curated palettes keyed by the chart appearance.colorSchema enum value.
// 'default' is a CVD-validated categorical cycle — the fixed slot order is
// the colorblind-safety mechanism, so never resort or skip slots.
// 'custom' is reserved — when wired, it consumes appearance.customColorSchema.
export const CHART_PALETTES: Record<string, string[]> = {
  default: ['#2A78D6', '#1BAF7A', '#EDA100', '#008300', '#4A3AA7', '#E34948', '#E87BA4', '#EB6834'],
  classic: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#9C755F', '#FF9DA7', '#BAB0AC'],
  vibrant: ['#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#0EA5E9', '#EF4444', '#14B8A6', '#A855F7', '#F97316', '#22D3EE'],
  pastel: ['#A5B4FC', '#FCA5A5', '#FCD34D', '#86EFAC', '#67E8F9', '#F9A8D4', '#FDBA74', '#C4B5FD', '#FECACA', '#BBF7D0'],
  earth: ['#8B4513', '#CD853F', '#DAA520', '#6B8E23', '#A0522D', '#D2691E', '#BC8F8F', '#556B2F', '#8FBC8F', '#B8860B'],
  monoBlue: ['#0B2D7A', '#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE'],
  coastal: ['#364DA3', '#4485B2', '#3DBFBF', '#FFBCAF', '#F4777F', '#CF3759'],
  meadow: ['#364A5F', '#296A75', '#27897D', '#4EA777', '#AACC11', '#D3D55C'],
  dusk: ['#003F5C', '#444E86', '#955196', '#DD5182', '#FF6E54', '#FFA600'],
  harbor: [
    '#B75035',
    '#46C19A',
    '#5A3A8E',
    '#97B241',
    '#6E81DA',
    '#CD9C2E',
    '#C771C4',
    '#5DBB68',
    '#B0457B',
    '#6F8839',
    '#BA4758',
    '#C18A43',
  ],
  // High-contrast colorblind-safe 12-slot cycle
  contrast: [
    '#000000',
    '#004949',
    '#009292',
    '#FF6DB6',
    '#FFB6DB',
    '#490092',
    '#006DDB',
    '#B66DFF',
    '#6DB6FF',
    '#B6DBFF',
    '#920000',
    '#924900',
  ],
  breeze: [
    '#71CDEB',
    '#E9B198',
    '#74AFF3',
    '#BFDCA1',
    '#E6AFD3',
    '#96D8AB',
    '#B4BCEC',
    '#D7D09E',
    '#71D7CE',
    '#A5CEAE',
    '#ADEFE6',
    '#8BC6C2',
  ],
  neon: [
    '#A300CD',
    '#7AD8B5',
    '#4858FF',
    '#B74800',
    '#9D7BFF',
    '#007656',
    '#FF3BBD',
    '#F5BB7D',
    '#620068',
    '#FC0042',
    '#014F7C',
    '#800034',
  ],
  bold: [
    '#004586',
    '#FF420E',
    '#FFD320',
    '#579D1C',
    '#7E0021',
    '#83CAFF',
    '#314004',
    '#AECF00',
    '#4B1F6F',
    '#FF950E',
    '#C5000B',
    '#0084D1',
  ],
  savanna: [
    '#73B48A',
    '#3A332A',
    '#BAC77F',
    '#4D5B29',
    '#AEA496',
    '#B0A17E',
    '#78A6A6',
    '#9C5643',
    '#4ABDD8',
    '#B28950',
    '#56C4B9',
    '#AF6771',
  ],
  chroma: ['#1F77B4', '#FF7F0E', '#2CA02C', '#D62728', '#9467BD', '#8C564B', '#E377C2', '#7F7F7F', '#BCBD22', '#17BECF'],
  parchment: [
    '#5C5547',
    '#D2C8AB',
    '#B49E86',
    '#E6D1BE',
    '#887A6F',
    '#3F3830',
    '#F7E2BE',
    '#BEAD9E',
    '#FFEED9',
    '#999078',
    '#7A715D',
    '#75695F',
    '#C2BBA7',
    '#E4CCAE',
    '#E5DBC3',
    '#96887B',
  ],
}

// `value` is the colorSchema enum value (also the i18n key suffix under
// general.chartPalette.*). Components resolve the display label via t().
export const CHART_PALETTE_OPTIONS = [
  { value: 'default', colors: CHART_PALETTES.default },
  { value: 'classic', colors: CHART_PALETTES.classic },
  { value: 'vibrant', colors: CHART_PALETTES.vibrant },
  { value: 'pastel', colors: CHART_PALETTES.pastel },
  { value: 'earth', colors: CHART_PALETTES.earth },
  { value: 'monoBlue', colors: CHART_PALETTES.monoBlue },
  { value: 'coastal', colors: CHART_PALETTES.coastal },
  { value: 'meadow', colors: CHART_PALETTES.meadow },
  { value: 'dusk', colors: CHART_PALETTES.dusk },
  { value: 'harbor', colors: CHART_PALETTES.harbor },
  { value: 'contrast', colors: CHART_PALETTES.contrast },
  { value: 'breeze', colors: CHART_PALETTES.breeze },
  { value: 'neon', colors: CHART_PALETTES.neon },
  { value: 'bold', colors: CHART_PALETTES.bold },
  { value: 'savanna', colors: CHART_PALETTES.savanna },
  { value: 'chroma', colors: CHART_PALETTES.chroma },
  { value: 'parchment', colors: CHART_PALETTES.parchment },
]

// Dark-surface twin of the default palette — same hue slots, lightness tuned
// for contrast against dark cards. Named palettes render as picked in both themes.
const CHART_PALETTE_DEFAULT_DARK = ['#3987E5', '#199E70', '#C98500', '#008300', '#9085E9', '#E66767', '#D55181', '#D95926']

/** The interface chart card surface in dark mode — the contrast target below. */
const DARK_CHART_SURFACE = '#1f2226'

const darkLiftedPaletteCache = new Map<string, string[]>()

/**
 * Named palettes are designed on white — 10 of them carry entries that sink
 * into the dark surface (deep navies, #000 in `contrast`, …). In dark mode,
 * weak entries lift LIGHTNESS only (hue/saturation identity kept) until they
 * clear ~2.2:1 against the surface; already-legible entries pass through
 * untouched, so light-designed palettes stay recognizably themselves.
 */
function liftPaletteForDark(schema: string, colors: string[]): string[] {
  const cached = darkLiftedPaletteCache.get(schema)
  if (cached) return cached

  const lifted = colors.map((color) => {
    let c = tinycolor(color)

    for (let i = 0; i < 12 && tinycolor.readability(c, DARK_CHART_SURFACE) < 2.2; i++) {
      c = c.lighten(6)
    }

    return c.toHexString()
  })

  darkLiftedPaletteCache.set(schema, lifted)

  return lifted
}

export const getChartColors = (schema?: string | null, isDark = false): string[] => {
  if ((!schema || schema === 'default') && isDark) return CHART_PALETTE_DEFAULT_DARK

  const key = schema ?? 'default'
  const palette = CHART_PALETTES[key] ?? CHART_PALETTES.default!

  // Curated dark twin only exists for the default palette — the rest adapt
  return isDark ? liftPaletteForDark(key, palette) : palette
}

// Legacy named export kept for any remaining consumer; resolves to the
// default (brand) palette. New chart code reads getChartColors(appearance.colorSchema).
export const CHART_COLORS = CHART_PALETTES.default!

/** Grid freeze — max frozen fields, display value included. Mirrored by the interface viz schema (`config-schemas.ts`). */
export const MAX_FROZEN_FIELDS = 3

/** Frozen field count as persisted in grid view meta / interface viz config. Anything unusable falls back to 1. */
export const clampFrozenFieldCount = (value: unknown): number =>
  ncIsNumber(value) ? Math.min(Math.max(Math.round(value), 1), MAX_FROZEN_FIELDS) : 1

/** Virtual section ID for views not assigned to any real section */
export const DEFAULT_SECTION_ID = '__default__'

export const showWsSettingsInBase = false

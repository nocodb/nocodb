import tinycolor from 'tinycolor2'

/**
 * White-label brand-scale generation.
 *
 * NocoDB's entire accented surface (buttons, hovers, links, selected rows,
 * focus rings, brand-tinted backgrounds) is driven by the `--color-brand-*`
 * reference palette (see assets/css/variables.css). A white-label admin only
 * picks a single seed hex, so we derive the full 20→900 ramp from it — for
 * both light mode and the inverted dark-mode ramp — plus the Ant Design
 * primary tokens, so a single colour recolours the whole product coherently.
 */

const BRAND_STOPS = [20, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

const AUTOFILL_SELECTORS = [
  'input:-webkit-autofill',
  'input:-webkit-autofill:hover',
  'input:-webkit-autofill:focus',
  'textarea:-webkit-autofill',
  'textarea:-webkit-autofill:hover',
  'textarea:-webkit-autofill:focus',
].join(',\n')

const AUTOFILL_NEUTRALIZE = `${AUTOFILL_SELECTORS} {
  -webkit-box-shadow: inset 0 0 0 1000px var(--nc-bg-default) !important;
  box-shadow: inset 0 0 0 1000px var(--nc-bg-default) !important;
  -webkit-text-fill-color: var(--nc-content-gray) !important;
}`

/**
 * Light-mode lightness interpolation, calibrated against the default #3366ff
 * ramp. The seed is anchored at 500 (frac 0); positive fracs interpolate the
 * lightness toward LIGHT_MAX_L, negative toward LIGHT_MIN_L. Anchoring at the
 * seed keeps the ramp monotonic regardless of the seed's own lightness.
 */
const LIGHT_FRAC: Record<number, number> = {
  20: 1.0,
  50: 0.97,
  100: 0.84,
  200: 0.63,
  300: 0.42,
  400: 0.21,
  500: 0,
  600: -0.25,
  700: -0.5,
  800: -0.75,
  900: -1.0,
}

const LIGHT_MAX_L = 98
const LIGHT_MIN_L = 10

/**
 * The design-system ramps desaturate as they darken (e.g. brand-600 is a muted
 * navy, not a pure electric blue; orange-800 is a muted brown). We mirror that
 * by tapering saturation on the dark stops. Stops not listed keep full seed
 * saturation.
 */
const LIGHT_SAT_FACTOR: Record<number, number> = {
  600: 0.72,
  700: 0.7,
  800: 0.68,
  900: 0.66,
}

/**
 * Dark mode is an inverted ramp (500 is *lighter* than the seed, 900 is
 * near-white) with fixed lightness targets mirroring the hand-tuned dark brand
 * palette in variables.css.
 */
const DARK_L: Record<number, number> = {
  20: 12,
  50: 16,
  100: 33,
  200: 40,
  300: 53,
  400: 60,
  500: 67,
  600: 78,
  700: 85,
  800: 92,
  900: 97,
}

interface BrandStop {
  hex: string
  /** "r, g, b" — matches the --rgb-color-* tuple form used by ncBuildColorsWithOpacity */
  rgb: string
}

export interface BrandScale {
  light: Record<number, BrandStop>
  dark: Record<number, BrandStop>
}

function clampL(v: number): number {
  return Math.max(0, Math.min(100, v))
}

/**
 * Whether white button text stays legible on the seed colour (it's the 500 fill
 * behind `text-white` primary buttons). Uses WCAG AA at "large" size (3:1) —
 * NocoDB button labels are 14px medium-weight, which qualifies as large text —
 * so reasonable brand colours pass and only egregiously light/low-contrast
 * picks (pale tints, bright yellow) are flagged. Returns null for invalid hex.
 */
export function isBrandColorReadable(seedHex: string): boolean | null {
  const c = tinycolor(seedHex)
  if (!c.isValid()) return null
  return tinycolor.isReadable(c, '#ffffff', { level: 'AA', size: 'large' })
}

function toStop(h: number, s: number, l: number): BrandStop {
  const c = tinycolor({ h, s, l })
  const { r, g, b } = c.toRgb()
  return { hex: c.toHexString(), rgb: `${r}, ${g}, ${b}` }
}

/**
 * Generate the full light + dark brand ramp from a single seed hex.
 * Returns null when the seed is not a valid colour.
 */
export function generateBrandScale(seedHex: string): BrandScale | null {
  const seed = tinycolor(seedHex)
  if (!seed.isValid()) return null

  const { h, s, l } = seed.toHsl()
  const seedSat = s * 100
  const seedL = l * 100

  const light: Record<number, BrandStop> = {}
  const dark: Record<number, BrandStop> = {}

  for (const stop of BRAND_STOPS) {
    const frac = LIGHT_FRAC[stop]
    let lightL: number
    if (frac === 0) {
      lightL = seedL
    } else if (frac > 0) {
      lightL = seedL + frac * (LIGHT_MAX_L - seedL)
    } else {
      lightL = seedL + frac * (seedL - LIGHT_MIN_L) // frac < 0 → subtracts toward LIGHT_MIN_L
    }

    const lightSat = clampL(seedSat * (LIGHT_SAT_FACTOR[stop] ?? 1))

    light[stop] = toStop(h, lightSat, clampL(lightL))
    dark[stop] = toStop(h, seedSat, DARK_L[stop])
  }

  return { light, dark }
}

function brandVars(stops: Record<number, BrandStop>): string {
  return BRAND_STOPS.map(
    (stop) => `  --color-brand-${stop}: ${stops[stop].hex}; --rgb-color-brand-${stop}: ${stops[stop].rgb};`,
  ).join('\n')
}

/**
 * Ant Design primary tokens. These are set with `!important` in
 * ee/assets/style.scss, so the injected overrides must also use `!important`
 * to win the cascade. `invert` flips hover/active for the dark ramp (where
 * lighter = up the scale).
 */
function antVars(stops: Record<number, BrandStop>, invert = false): string {
  const hover = invert ? stops[600] : stops[400]
  const active = invert ? stops[400] : stops[600]
  return [
    `  --ant-primary-color: ${stops[500].hex} !important;`,
    `  --ant-primary-color-hover: ${hover.hex} !important;`,
    `  --ant-primary-color-active: ${active.hex} !important;`,
    `  --ant-primary-color-outline: rgba(${stops[500].rgb}, 0.24) !important;`,
  ].join('\n')
}

/**
 * The static `brand-*` Windi utilities (from `themeV3Colors`) compile to
 * hardcoded hex literals, not CSS vars, so the var overrides above can't reach
 * them — primary buttons (`Button.vue`) and a few accent texts/icons use them.
 *
 * We redirect those utilities to the seed-derived colours, but ONLY here in the
 * white-label stylesheet (which is absent unless a brand colour is set), so
 * default / CE / Cloud builds render byte-identical CSS to today.
 *
 * `themeV3Colors` is intentionally mode-independent (#3366ff in light AND dark),
 * so we mirror that: the light-ramp hex is applied with no `[theme]` selector,
 * keeping a white-labelled primary button the picked colour in both modes —
 * exactly how the default blue behaves today.
 *
 * Coverage is the full ramp for the base `bg`/`text`/`border`/`fill` utilities
 * plus the primary button's responsive hover (targeted by component selector to
 * avoid brittle escaped media-query class names). Variant utilities on minor
 * surfaces (e.g. a couple of `hover:bg-brand-100` tints) are intentionally left
 * on the default tint — see plan.md.
 */
function staticBrandOverrides(light: Record<number, BrandStop>): string {
  const props: Array<[prefix: string, cssProp: string]> = [
    ['bg', 'background-color'],
    ['text', 'color'],
    ['border', 'border-color'],
    ['fill', 'fill'],
  ]

  const lines: string[] = []
  for (const [prefix, cssProp] of props) {
    for (const stop of BRAND_STOPS) {
      lines.push(`.${prefix}-brand-${stop} { ${cssProp}: ${light[stop].hex} !important; }`)
    }
  }

  // Primary button (Button.vue: `bg-brand-500 md:(hover:bg-brand-600)`).
  // Scope to the enabled state so the `!important` doesn't bleed the brand
  // colour onto the disabled / show-as-disabled grey (those keep ant-btn-primary
  // but should stay neutral grey).
  const enabled = '.nc-button.ant-btn-primary.theme-default:not([disabled]):not(.nc-show-as-disabled)'
  lines.push(`${enabled} { background-color: ${light[500].hex} !important; }`)
  lines.push(`${enabled}:hover { background-color: ${light[600].hex} !important; }`)

  return lines.join('\n')
}

/**
 * Build the full stylesheet that overrides the brand ramp (light under :root,
 * dark under [theme='dark']), the mode-independent --nc-brand-accent (which
 * backs the hand-written #3366ff literals: checkbox fill, focus rings,
 * box-shadows, text selection), the static `brand-*` utilities, and the Ant
 * Design primary tokens. Returns null for an invalid seed so callers can fall
 * back to the built-in defaults.
 */
export function buildBrandStyleCss(seedHex: string): string | null {
  const scale = generateBrandScale(seedHex)
  if (!scale) return null

  const accent = scale.light[500]

  return [
    ':root {',
    brandVars(scale.light),
    antVars(scale.light),
    // Mode-independent (defined only here, mirroring the source literals).
    `  --nc-brand-accent: ${accent.hex};`,
    `  --nc-brand-accent-rgb: ${accent.rgb};`,
    '}',
    "[theme='dark'] {",
    brandVars(scale.dark),
    antVars(scale.dark, true),
    '}',
    staticBrandOverrides(scale.light),
    // Neutralise the browser's blue autofill background so it doesn't clash with
    // the brand. Only emitted in this white-label sheet, so default logins keep
    // the native autofill look. box-shadow is the only way to override Chrome's
    // autofill fill; paint it with the input surface colour (theme-adaptive).
    AUTOFILL_NEUTRALIZE,
  ].join('\n')
}

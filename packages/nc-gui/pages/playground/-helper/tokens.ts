import { barcodeCache } from '~/components/smartsheet/grid/canvas/utils/canvas'
import { fontStyleMap } from '~/assets/nc-typography-preset'

export type TokenMode = 'light' | 'dark'

export interface TypeStyle {
  size: number
  lineHeight: number
  weight: number
  letterSpacing: number
}

export interface TokenOverrides {
  light: Record<string, string>
  dark: Record<string, string>
  font: string
  radiusScale: number
  typography: Record<string, Partial<TypeStyle>>
  typeScale: number
  iconStroke: number
}

const ICON_STROKE_WIDTHS = ['0.66', '1', '1.2', '1.33', '1.33333', '1.5', '1.66', '2']

export const TYPE_STYLES: Array<{ key: string } & TypeStyle> = Object.entries(fontStyleMap).map(([key, [size, o]]) => ({
  key,
  size: parseFloat(size),
  lineHeight: parseFloat(o.lineHeight),
  weight: o.fontWeight,
  letterSpacing: o.letterSpacing ? parseFloat(o.letterSpacing) * 16 : 0,
}))

export const scaledTypeStyle = (key: string, factor: number): TypeStyle | undefined => {
  const s = TYPE_STYLES.find((style) => style.key === key)
  if (!s) return undefined
  if (factor === 1) return { size: s.size, lineHeight: s.lineHeight, weight: s.weight, letterSpacing: s.letterSpacing }
  return {
    size: Math.round(s.size * factor * 2) / 2,
    lineHeight: Math.round(s.lineHeight * factor),
    weight: s.weight,
    letterSpacing: s.letterSpacing,
  }
}

// utilities compile to palette stops, not the --nc-* var
const SEMANTIC_UTILITIES: Record<string, Array<[prefix: string, property: string]>> = {
  content: [['text', 'color']],
  bg: [['bg', 'background-color']],
  border: [['border', 'border-color']],
  fill: [
    ['bg', 'background-color'],
    ['text', 'color'],
    ['fill', 'fill'],
  ],
}

export interface TokenDef {
  name: string
  group: string
  light: string
  dark: string
}

const FONT_EXCLUDED = [
  '.material-symbols',
  '.material-icons',
  'code',
  'code *',
  'pre',
  'pre *',
  'kbd',
  'samp',
  '.font-mono',
  '.font-dmmono',
  '.monaco-editor *',
  '.cm-editor *',
].join(', ')

const STORAGE_KEY = 'nc-playground-tokens'
const STYLE_ID = 'nc-playground-tokens'

const RAMP_STOPS = [20, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

export const FONT_OPTIONS = [
  { label: 'Product default', value: '' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Manrope', value: 'Manrope' },
  { label: 'System UI', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Source Sans Pro', value: '"Source Sans Pro"' },
  { label: 'Georgia (serif)', value: 'Georgia, serif' },
]

const emptyOverrides = (): TokenOverrides => ({
  light: {},
  dark: {},
  font: '',
  radiusScale: 1,
  typography: {},
  typeScale: 1,
  iconStroke: 1,
})

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const isTokenOverrides = (v: unknown): v is Partial<TokenOverrides> => {
  if (!isPlainObject(v)) return false
  const checks: Record<keyof TokenOverrides, (x: unknown) => boolean> = {
    light: (x) => isPlainObject(x) && Object.values(x).every((y) => typeof y === 'string'),
    dark: (x) => isPlainObject(x) && Object.values(x).every((y) => typeof y === 'string'),
    font: (x) => typeof x === 'string',
    radiusScale: (x) => typeof x === 'number',
    typography: isPlainObject,
    typeScale: (x) => typeof x === 'number',
    iconStroke: (x) => typeof x === 'number',
  }
  const keys = Object.keys(v)
  return keys.some((k) => k in checks) && keys.every((k) => !(k in checks) || checks[k as keyof TokenOverrides](v[k]))
}

export const hexToRgbTriplet = (hex: string): string | null => {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`
}

const mixHex = (a: string, b: string, weightOfA: number) => {
  const ra = hexToRgbTriplet(a)!.split(',').map(Number)
  const rb = hexToRgbTriplet(b)!.split(',').map(Number)
  return `#${ra
    .map((v, i) => Math.round(v * weightOfA + rb[i] * (1 - weightOfA)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}

// dark mode inverts the ramp, as variables.css does
export const generateRamp = (base: string, mode: TokenMode): Record<number, string> => {
  const light: Record<number, number> = { 20: 0.03, 50: 0.06, 100: 0.18, 200: 0.36, 300: 0.54, 400: 0.76 }
  const shade: Record<number, number> = { 600: 0.8, 700: 0.6, 800: 0.4, 900: 0.2 }
  const ramp: Record<number, string> = {}
  for (const stop of RAMP_STOPS) {
    if (mode === 'light') {
      if (stop === 500) ramp[stop] = base
      else if (stop < 500) ramp[stop] = mixHex(base, '#ffffff', light[stop])
      else ramp[stop] = mixHex(base, '#000000', shade[stop])
    } else {
      const darkWeights: Record<number, number> = { 20: 0.08, 50: 0.12, 100: 0.3, 200: 0.5, 300: 0.75 }
      const lightWeights: Record<number, number> = { 500: 0.78, 600: 0.55, 700: 0.35, 800: 0.2, 900: 0.08 }
      if (stop === 400) ramp[stop] = base
      else if (stop < 400) ramp[stop] = mixHex(base, '#171717', darkWeights[stop])
      else ramp[stop] = mixHex(base, '#ffffff', lightWeights[stop])
    }
  }
  return ramp
}

const antPrimaryPalette = (base: string): Record<string, string> => {
  const rgb = hexToRgbTriplet(base)
  return {
    '--ant-primary-1': mixHex(base, '#ffffff', 0.1),
    '--ant-primary-2': mixHex(base, '#ffffff', 0.2),
    '--ant-primary-3': mixHex(base, '#ffffff', 0.4),
    '--ant-primary-4': mixHex(base, '#ffffff', 0.6),
    '--ant-primary-5': mixHex(base, '#ffffff', 0.8),
    '--ant-primary-6': base,
    '--ant-primary-7': mixHex(base, '#000000', 0.8),
    '--ant-primary-color-deprecated-l-35': mixHex(base, '#ffffff', 0.12),
    '--ant-primary-color-deprecated-l-20': mixHex(base, '#ffffff', 0.5),
    '--ant-primary-color-deprecated-t-20': mixHex(base, '#ffffff', 0.8),
    '--ant-primary-color-deprecated-t-50': mixHex(base, '#ffffff', 0.5),
    '--ant-primary-color-deprecated-f-12': `rgba(${rgb}, 0.12)`,
    '--ant-primary-color-active-deprecated-f-30': `rgba(${rgb}, 0.3)`,
    '--ant-primary-color-active-deprecated-d-02': base,
  }
}

const countEdits = (o: TokenOverrides) => {
  const names = [...new Set([...Object.keys(o.light), ...Object.keys(o.dark)])]
  const fullRamps = new Set<string>()
  for (const name of names) {
    const hue = name.match(/^--color-([a-z]+)-\d+$/)?.[1]
    if (hue && [o.light, o.dark].some((v) => RAMP_STOPS.every((stop) => `--color-${hue}-${stop}` in v))) fullRamps.add(hue)
  }
  const loose = names.filter((name) => {
    const hue = name.match(/^--color-([a-z]+)-\d+$/)?.[1]
    if (hue) return !fullRamps.has(hue)
    return !(fullRamps.has('brand') && /^--(nc-brand-accent|ant-primary-)/.test(name))
  })
  const typeEdits = Object.entries(o.typography).filter(([key, style]) => {
    const scaled = scaledTypeStyle(key, o.typeScale ?? 1)
    return (Object.keys(style) as Array<keyof TypeStyle>).some((field) => style[field] !== scaled?.[field])
  }).length
  return (
    fullRamps.size +
    loose.length +
    typeEdits +
    ((o.typeScale ?? 1) !== 1 ? 1 : 0) +
    (o.font ? 1 : 0) +
    (o.radiusScale !== 1 ? 1 : 0) +
    (o.iconStroke !== 1 ? 1 : 0)
  )
}

const groupOf = (name: string) => {
  const ref = name.match(/^--color-([a-z]+)-/)
  if (ref) return `Palette · ${ref[1]}`
  const sys = name.match(/^--nc-(content|bg|border|fill)-/)
  if (sys) return `System · ${sys[1]}`
  if (name.startsWith('--spacing')) return 'Spacing'
  return 'Other'
}

const isDarkSelector = (sel: string) => /^\[theme=['"]dark['"]\]$/.test(sel.trim())

export const collectTokenDefs = (): TokenDef[] => {
  const defs = new Map<string, TokenDef>()
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule) {
        if ((rule.parentStyleSheet?.ownerNode as HTMLElement | null)?.id === STYLE_ID) continue
        const selectors = rule.selectorText.split(',').map((s) => s.trim())
        const forLight = selectors.includes(':root')
        const forDark = selectors.some(isDarkSelector)
        if (!forLight && !forDark) continue
        for (const prop of Array.from(rule.style)) {
          if (!prop.startsWith('--') || prop.startsWith('--rgb-') || prop.endsWith('-rgb') || prop.startsWith('--ant-')) continue
          const value = rule.style.getPropertyValue(prop).trim()
          const def = defs.get(prop) ?? { name: prop, group: groupOf(prop), light: '', dark: '' }
          if (forLight) def.light = value
          if (forDark) def.dark = value
          defs.set(prop, def)
        }
      } else if ('cssRules' in rule) {
        visit((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules)
    } catch {}
  }
  for (const def of defs.values()) {
    if (!def.dark) def.dark = def.light
    if (!def.light) def.light = def.dark
  }
  const rank = (group: string) => ['Palette', 'System', 'Spacing', 'Other'].findIndex((p) => group.startsWith(p))
  return [...defs.values()].sort(
    (a, b) =>
      rank(a.group) - rank(b.group) ||
      a.group.localeCompare(b.group) ||
      a.name.localeCompare(b.name, undefined, { numeric: true }),
  )
}

export const resolveTokenValue = (
  defs: Map<string, TokenDef>,
  o: TokenOverrides,
  mode: TokenMode,
  name: string,
  depth = 0,
): string => {
  const value = o[mode][name] ?? defs.get(name)?.[mode] ?? ''
  const ref = value.match(/^var\((--[\w-]+)\)$/)?.[1]
  return ref && depth < 8 ? resolveTokenValue(defs, o, mode, ref, depth + 1) : value
}

const declarations = (values: Record<string, string>) => {
  const lines: string[] = []
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue
    lines.push(`${name}: ${value} !important;`)
    const rgb = name.startsWith('--ant-') ? null : hexToRgbTriplet(value)
    if (rgb) lines.push(`--rgb-${name.slice(2)}: ${rgb} !important;`)
    if (rgb && name.startsWith('--nc-brand-accent')) lines.push(`${name}-rgb: ${rgb} !important;`)
  }
  return lines
}

export const buildCss = (o: TokenOverrides) => {
  const blocks: string[] = []
  const light = declarations(o.light)
  const dark = declarations(o.dark)
  if (light.length) blocks.push(`:root:not([theme='dark']) {\n  ${light.join('\n  ')}\n}`)
  if (dark.length) blocks.push(`[theme='dark'] {\n  ${dark.join('\n  ')}\n}`)

  // not !important: still loses to hover:/focus: variants and `!` utilities
  const semantic = new Set(
    [...Object.keys(o.light), ...Object.keys(o.dark)].filter((n) => /^--nc-(content|bg|border|fill)-/.test(n)),
  )
  const utilityRules: string[] = []
  for (const name of semantic) {
    const family = name.match(/^--nc-([a-z]+)-/)![1]
    for (const [prefix, property] of SEMANTIC_UTILITIES[family] ?? []) {
      utilityRules.push(`.${prefix}-${name.slice(2)} { ${property}: var(${name}); }`)
    }
  }
  if (utilityRules.length) blocks.push(utilityRules.join('\n'))

  const typeRules = Object.entries(o.typography ?? {})
    .filter(([, t]) => Object.keys(t).length)
    .map(([key, t]) => {
      const props = [
        t.size !== undefined ? `font-size: ${t.size}px;` : '',
        t.lineHeight !== undefined ? `line-height: ${t.lineHeight}px;` : '',
        t.weight !== undefined ? `font-weight: ${t.weight};` : '',
        t.letterSpacing !== undefined ? `letter-spacing: ${t.letterSpacing}px;` : '',
      ]
      return `.text-${key} { ${props.filter(Boolean).join(' ')} }`
    })
  if (typeRules.length) blocks.push(typeRules.join('\n'))

  // CSS stroke-width beats the SVG attribute; scaling each shipped width keeps relative weights
  if (o.iconStroke && o.iconStroke !== 1) {
    blocks.push(
      ICON_STROKE_WIDTHS.map(
        (w) => `svg[stroke-width="${w}"], svg [stroke-width="${w}"] { stroke-width: ${+(Number(w) * o.iconStroke).toFixed(3)}; }`,
      ).join('\n'),
    )
  }

  // Button.vue paints primary from the static bg-brand-500 utility, not a var
  if (o.light['--nc-brand-accent'] || o.dark['--nc-brand-accent']) {
    const enabled = '.nc-button.ant-btn-primary.theme-default:not([disabled]):not(.nc-show-as-disabled)'
    blocks.push(
      [
        `${enabled} { background-color: var(--nc-brand-accent) !important; }`,
        `${enabled}:hover, ${enabled}:active { background-color: var(--nc-brand-accent-hover) !important; }`,
      ].join('\n'),
    )
  }

  if (o.font) {
    blocks.push(`body, body *:not(:is(${FONT_EXCLUDED})) { font-family: ${o.font} !important; }`)
  }
  if (o.radiusScale !== 1) {
    const r = o.radiusScale
    blocks.push(
      [
        `.rounded-sm { border-radius: ${2 * r}px !important; }`,
        `.rounded { border-radius: ${4 * r}px !important; }`,
        `.rounded-md { border-radius: ${6 * r}px !important; }`,
        `.rounded-lg { border-radius: ${8 * r}px !important; }`,
        `.rounded-xl { border-radius: ${12 * r}px !important; }`,
        `.rounded-2xl { border-radius: ${16 * r}px !important; }`,
        `.nc-button.ant-btn, .ant-input, .ant-dropdown-menu, .ant-modal-content { border-radius: ${8 * r}px !important; }`,
        `.ant-select .ant-select-selector { border-radius: ${6 * r}px !important; }`,
      ].join('\n'),
    )
  }
  return blocks.join('\n\n')
}

const rampValues = (hue: string, base: string, mode: TokenMode): Record<string, string> => {
  const ramp = generateRamp(base, mode)
  const values: Record<string, string> = {}
  for (const stop of RAMP_STOPS) values[`--color-${hue}-${stop}`] = ramp[stop]
  if (hue === 'brand') {
    values['--nc-brand-accent'] = base
    values['--nc-brand-accent-hover'] = mixHex(base, '#000000', 0.8)
    values['--ant-primary-color'] = base
    values['--ant-primary-color-hover'] = mixHex(base, '#ffffff', 0.76)
    values['--ant-primary-color-active'] = base
    values['--ant-primary-color-outline'] = `rgba(${hexToRgbTriplet(base)}, 0.24)`
    Object.assign(values, antPrimaryPalette(base))
  }
  return values
}

export const exampleTokens = (): TokenOverrides => ({
  ...emptyOverrides(),
  light: { ...rampValues('brand', '#7c3aed', 'light'), '--nc-content-gray-emphasis': '#1e1b4b' },
  dark: rampValues('brand', '#7c3aed', 'dark'),
  radiusScale: 1.25,
})

export const usePlaygroundTokens = createSharedComposable(() => {
  const overrides = ref<TokenOverrides>(emptyOverrides())
  const frames = new Set<HTMLIFrameElement>()
  const { clearColorCache, themeRepaintVersion } = useTheme()

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) overrides.value = { ...emptyOverrides(), ...JSON.parse(stored) }
  } catch {}

  const css = computed(() => buildCss(overrides.value))

  const writeStyle = (doc: Document) => {
    let el = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!css.value) {
      el?.remove()
      return
    }
    if (!el) {
      el = doc.createElement('style')
      el.id = STYLE_ID
    }
    el.textContent = css.value
    // last, so it wins source-order ties with the dark-palette style
    doc.head.appendChild(el)
  }

  const apply = () => {
    writeStyle(document)
    for (const frame of frames) {
      try {
        if (frame.contentDocument?.head) writeStyle(frame.contentDocument)
      } catch {
        frames.delete(frame)
      }
    }
    barcodeCache.clear()
    clearColorCache()
    themeRepaintVersion.value++
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides.value))
    } catch {}
  }

  watch(css, apply, { immediate: true })

  const setToken = (mode: TokenMode, name: string, value: string | null) => {
    const next = { ...overrides.value[mode] }
    if (value) next[name] = value
    else delete next[name]
    overrides.value = { ...overrides.value, [mode]: next }
  }

  const setRamp = (hue: string, base: string, modes: TokenMode[] = ['light', 'dark']) => {
    const next = { ...overrides.value }
    for (const mode of modes) next[mode] = { ...next[mode], ...rampValues(hue, base, mode) }
    overrides.value = next
  }

  const clearRamp = (hue: string) => {
    const strip = (values: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(values).filter(
          ([k]) => !k.startsWith(`--color-${hue}-`) && !(hue === 'brand' && /^--(nc-brand-accent|ant-primary-)/.test(k)),
        ),
      )
    overrides.value = { ...overrides.value, light: strip(overrides.value.light), dark: strip(overrides.value.dark) }
  }

  /** `null` field: back to the preset; `null` patch: back to the overall scale */
  const setTypography = (key: string, patch: Partial<Record<keyof TypeStyle, number | null>> | null) => {
    const next = { ...overrides.value.typography }
    const factor = overrides.value.typeScale ?? 1
    if (!patch) {
      const scaled = scaledTypeStyle(key, factor)
      if (factor !== 1 && scaled) next[key] = { size: scaled.size, lineHeight: scaled.lineHeight }
      else delete next[key]
    } else {
      const style = { ...next[key] }
      for (const [field, value] of Object.entries(patch) as Array<[keyof TypeStyle, number | null]>) {
        if (value === null || Number.isNaN(value)) delete style[field]
        else style[field] = value
      }
      if (Object.keys(style).length) next[key] = style
      else delete next[key]
    }
    overrides.value = { ...overrides.value, typography: next }
  }

  const scaleTypography = (factor: number) => {
    const typography: TokenOverrides['typography'] = {}
    for (const s of TYPE_STYLES) {
      const { size: _size, lineHeight: _lineHeight, ...kept } = overrides.value.typography[s.key] ?? {}
      const scaled = scaledTypeStyle(s.key, factor)!
      const style = factor === 1 ? kept : { ...kept, size: scaled.size, lineHeight: scaled.lineHeight }
      if (Object.keys(style).length) typography[s.key] = style
    }
    overrides.value = { ...overrides.value, typography, typeScale: factor }
  }

  const reset = () => {
    overrides.value = emptyOverrides()
  }

  const importJson = (json: string): 'ok' | 'invalidJson' | 'wrongShape' => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      return 'invalidJson'
    }
    if (!isTokenOverrides(parsed)) return 'wrongShape'
    overrides.value = { ...emptyOverrides(), ...parsed }
    return 'ok'
  }

  const overrideCount = computed(() => countEdits(overrides.value))

  const registerFrame = (frame: HTMLIFrameElement) => {
    frames.add(frame)
    if (frame.contentDocument?.head) writeStyle(frame.contentDocument)
  }

  const unregisterFrame = (frame: HTMLIFrameElement) => frames.delete(frame)

  return {
    overrides,
    css,
    overrideCount,
    setToken,
    setRamp,
    clearRamp,
    setTypography,
    scaleTypography,
    reset,
    importJson,
    registerFrame,
    unregisterFrame,
  }
})

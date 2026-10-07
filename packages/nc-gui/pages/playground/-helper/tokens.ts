import { barcodeCache } from '~/components/smartsheet/grid/canvas/utils/canvas'

export type TokenMode = 'light' | 'dark'

export interface TokenOverrides {
  light: Record<string, string>
  dark: Record<string, string>
  /** font-family applied app-wide; empty = product default */
  font: string
  /** multiplier for border radii (1 = product default) */
  radiusScale: number
}

export interface TokenDef {
  name: string
  group: string
  light: string
  dark: string
}

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

const emptyOverrides = (): TokenOverrides => ({ light: {}, dark: {}, font: '', radiusScale: 1 })

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

/** 20..900 ramp around a 500 base; dark mode inverts it like variables.css does */
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

const groupOf = (name: string) => {
  const ref = name.match(/^--color-([a-z]+)-/)
  if (ref) return `Palette · ${ref[1]}`
  const sys = name.match(/^--nc-(content|bg|border|fill)-/)
  if (sys) return `System · ${sys[1]}`
  if (name.startsWith('--spacing')) return 'Spacing'
  return 'Other'
}

const isDarkSelector = (sel: string) => /^\[theme=['"]dark['"]\]$/.test(sel.trim())

/** Reads every custom property declared on :root / [theme='dark'] in the loaded stylesheets. */
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
    } catch {
      // cross-origin sheet (Google Fonts)
    }
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

const declarations = (values: Record<string, string>) => {
  const lines: string[] = []
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue
    lines.push(`${name}: ${value} !important;`)
    const rgb = hexToRgbTriplet(value)
    if (rgb) lines.push(`--rgb-${name.slice(2)}: ${rgb} !important;`)
    if (rgb && name.startsWith('--nc-brand-accent')) lines.push(`${name}-rgb: ${rgb} !important;`)
  }
  return lines
}

export const buildCss = (o: TokenOverrides) => {
  const blocks: string[] = []
  const light = declarations(o.light)
  const dark = declarations(o.dark)
  if (light.length) blocks.push(`:root {\n  ${light.join('\n  ')}\n}`)
  if (dark.length) blocks.push(`[theme='dark'] {\n  ${dark.join('\n  ')}\n}`)
  if (o.font) blocks.push(`body, body * { font-family: ${o.font} !important; }`)
  if (o.radiusScale !== 1) {
    const r = o.radiusScale
    blocks.push(
      [
        `.rounded-sm { border-radius: ${2 * r}px !important; }`,
        `.rounded, .rounded-md { border-radius: ${6 * r}px !important; }`,
        `.rounded-lg { border-radius: ${8 * r}px !important; }`,
        `.rounded-xl { border-radius: ${12 * r}px !important; }`,
        `.rounded-2xl { border-radius: ${16 * r}px !important; }`,
        `.nc-button.ant-btn, .ant-input, .ant-select-selector, .ant-dropdown-menu, .ant-modal-content { border-radius: ${
          8 * r
        }px !important; }`,
      ].join('\n'),
    )
  }
  return blocks.join('\n\n')
}

/**
 * Live design-token overrides for the playground. Writes one `<style>` into the
 * host document and every registered same-origin iframe, mirroring how
 * useTheme() applies the dark palette.
 */
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
    // keep it last so it wins source-order ties with the dark-palette style
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
    for (const mode of modes) {
      const ramp = generateRamp(base, mode)
      const values = { ...next[mode] }
      for (const stop of RAMP_STOPS) values[`--color-${hue}-${stop}`] = ramp[stop]
      if (hue === 'brand') {
        values['--nc-brand-accent'] = base
        values['--nc-brand-accent-hover'] = mixHex(base, '#000000', 0.8)
        values['--ant-primary-color'] = base
        values['--ant-primary-color-hover'] = mixHex(base, '#ffffff', 0.76)
        values['--ant-primary-color-active'] = base
        values['--ant-primary-color-outline'] = `rgba(${hexToRgbTriplet(base)}, 0.24)`
      }
      next[mode] = values
    }
    overrides.value = next
  }

  const clearRamp = (hue: string) => {
    const strip = (values: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(values).filter(
          ([k]) => !k.startsWith(`--color-${hue}-`) && !(hue === 'brand' && /^--(nc-brand-accent|ant-primary-color)/.test(k)),
        ),
      )
    overrides.value = { ...overrides.value, light: strip(overrides.value.light), dark: strip(overrides.value.dark) }
  }

  const reset = () => {
    overrides.value = emptyOverrides()
  }

  const importJson = (json: string) => {
    overrides.value = { ...emptyOverrides(), ...JSON.parse(json) }
  }

  const overrideCount = computed(
    () =>
      Object.keys(overrides.value.light).length +
      Object.keys(overrides.value.dark).length +
      (overrides.value.font ? 1 : 0) +
      (overrides.value.radiusScale !== 1 ? 1 : 0),
  )

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
    reset,
    importJson,
    registerFrame,
    unregisterFrame,
  }
})

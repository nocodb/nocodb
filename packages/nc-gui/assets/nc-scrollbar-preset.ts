import type { CSSObject, Preset } from 'unocss'

// Faithful port of @windicss/plugin-scrollbar. unocss-preset-scrollbar is not a
// drop-in — it names things scrollbar-thumb-color-* where Windi used
// scrollbar-thumb-* — so porting keeps the ~545 existing usages untouched.

const SIZE_BASE: CSSObject = {
  '--scrollbar-track': 'initial',
  '--scrollbar-thumb': 'initial',
  'scrollbar-color': 'var(--scrollbar-thumb) var(--scrollbar-track)',
  // Only has an effect in webkit, which is also the only place it is needed.
  'overflow': 'overlay',
}

// The ::-webkit-* rules have to reach the *consuming* selector, because ~30 SCSS blocks pull these
// in with `@apply nc-scrollbar-thin` rather than putting the class on the element. A preflight
// keyed to the class names cannot do that — it never learns about the @apply target. Carrying them
// on a variant does: transformerDirectives emits a variant's modified selector as its own rule, so
// `@apply` produces `.target::-webkit-scrollbar{…}` exactly as WindiCSS's nested addUtilities did.
const PSEUDO = {
  'nc-sb-bar': '::-webkit-scrollbar',
  'nc-sb-track': '::-webkit-scrollbar-track',
  'nc-sb-thumb': '::-webkit-scrollbar-thumb',
} as const

export interface NcScrollbarOptions {}

// Flattens nested theme colours the way WindiCSS's prefixed walk did.
function flattenColors(colors: Record<string, any>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(colors ?? {})) {
    if (value === null || value === undefined) continue

    const name = key === 'DEFAULT' ? prefix.replace(/-$/, '') : `${prefix}${key}`

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenColors(value, `${name}-`))
    } else if (typeof value === 'string') {
      // These land in a custom property, where UnoCSS never substitutes the
      // <alpha-value> placeholder its colour utilities rely on.
      out[name] = value.replace(/<alpha-value>/g, '1')
    }
  }

  return out
}

// theme.colors is fixed per config, so the walk only ever runs once per generator.
const colorCache = new WeakMap<object, Record<string, string>>()

function themeColor(theme: object, name: string): string | undefined {
  let flat = colorCache.get(theme)

  if (!flat) {
    flat = flattenColors((theme as { colors?: Record<string, any> }).colors ?? {})
    colorCache.set(theme, flat)
  }

  return flat[name]
}

export const ncScrollbarPreset = (_options: NcScrollbarOptions = {}): Preset => ({
  name: 'nc-scrollbar',

  variants: [
    {
      // Windi pre-generated `hover\:scrollbar-thumb-x` targeting the thumb's own
      // hover, not the element's — UnoCSS's built-in hover: would do the latter,
      // so this has to sort ahead of it.
      name: 'scrollbar-thumb-hover',
      order: -100,
      match(matcher) {
        if (!matcher.startsWith('hover:scrollbar-thumb-')) return
        return {
          matcher: matcher.slice('hover:'.length),
          selector: (s) => `${s}::-webkit-scrollbar-thumb:hover`,
        }
      },
    },
    {
      // Rewritten to a private token so the variant does not re-match itself.
      name: 'scrollbar-thumb-rounded',
      match(matcher) {
        const m = matcher.match(/^scrollbar-thumb-rounded(?:-(.+))?$/)
        if (!m) return
        return {
          matcher: `nc-sb-radius-${m[1] ?? 'DEFAULT'}`,
          selector: (s) => `${s}::-webkit-scrollbar-thumb`,
        }
      },
    },
    ...Object.entries(PSEUDO).map(([name, pseudo]) => ({
      name,
      match(matcher: string) {
        const prefix = `${name}:`
        if (!matcher.startsWith(prefix)) return
        return {
          matcher: matcher.slice(prefix.length),
          selector: (s: string) => `${s}${pseudo}`,
        }
      },
    })),
  ],

  rules: [
    ['nc-sb-base', SIZE_BASE],
    [/^nc-sb-width-(auto|thin)$/, ([, width]) => ({ 'scrollbar-width': width })],
    [/^nc-sb-size-(\d+)$/, ([, px]) => ({ width: `${px}px`, height: `${px}px` })],
    ['nc-sb-track-bg', { 'background-color': 'var(--scrollbar-track)' }],
    ['nc-sb-thumb-bg', { 'background-color': 'var(--scrollbar-thumb)' }],
    [
      /^scrollbar-(track|thumb)-(.+)$/,
      ([, part, name], { theme }) => {
        const value = themeColor(theme as object, name)
        if (value === undefined) return
        return { [`--scrollbar-${part}`]: value }
      },
    ],
    [
      /^nc-sb-radius-(.+)$/,
      ([, size], { theme }) => {
        const value = ((theme as any).borderRadius ?? {})[size]
        if (value === undefined) return
        return { 'border-radius': value }
      },
    ],
  ],

  // `layer: 'default'` keeps these level with the utilities, where WindiCSS's addUtilities put
  // them — the shortcuts layer sorts below and would lose ties against plain utilities.
  shortcuts: [
    [
      'scrollbar',
      'nc-sb-base nc-sb-width-auto nc-sb-bar:nc-sb-size-16 nc-sb-track:nc-sb-track-bg nc-sb-thumb:nc-sb-thumb-bg',
      { layer: 'default' },
    ],
    [
      'scrollbar-thin',
      'nc-sb-base nc-sb-width-thin nc-sb-bar:nc-sb-size-8 nc-sb-track:nc-sb-track-bg nc-sb-thumb:nc-sb-thumb-bg',
      { layer: 'default' },
    ],
  ],

  preflights: [
    {
      // WindiCSS's plugin-scrollbar addBase.
      getCSS: () => '*{scrollbar-color:initial;scrollbar-width:initial;}',
    },
  ],
})

export default ncScrollbarPreset

import type { Preset } from 'unocss'

const AXIS = {
  h: { prop: 'height', units: ['vh', 'dvh', 'svh'] },
  w: { prop: 'width', units: ['vw', 'dvw', 'svw'] },
} as const

const FADE_SIZE = '34px'

const maskImage = (gradient: string) => ({
  'mask-image': gradient,
  '-webkit-mask-image': gradient,
})

// Viewport-safe screen utilities: nc-h-screen (100vh), nc-h-screen-80 (80vh), and the
// min-/max- and w- variants.
//
// A shortcut rather than a rule: a rule's return value cannot carry an at-rule (nested objects
// stringify to [object Object]), but the `supports-[…]` variant can, and that @supports
// escalation is what WindiCSS emitted. Three same-property declarations are not equivalent —
// lightningcss, which Vite 8 uses to minify CSS, prunes them to the newest unit, leaving nothing
// at all for browsers without svh.
//
// `layer: 'default'` is load-bearing: the shortcuts layer sorts ahead of the utilities, so
// `nc-h-screen` would lose its tie against `h-full`, which it wins under WindiCSS.
export const ncScreenPreset = (): Preset => ({
  name: 'nc-screen',

  shortcuts: [
    [
      /^nc-(min-|max-)?([hw])-screen(?:-(\d{1,3}))?$/,
      ([, bound = '', axis, amount]) => {
        const value = amount === undefined ? 100 : Number(amount)
        if (value > 100) return

        const { prop, units } = AXIS[axis as keyof typeof AXIS]
        const [base, ...enhanced] = units

        return [
          `${bound}${axis}-[${value}${base}]`,
          ...enhanced.map((unit) => `supports-[${bound}${prop}:${value}${unit}]:${bound}${axis}-[${value}${unit}]`),
        ].join(' ')
      },
      { layer: 'default' },
    ],
  ],

  rules: [
    [
      'nc-scroll-fade',
      maskImage(`linear-gradient(transparent 0%, black ${FADE_SIZE}, black calc(100% - ${FADE_SIZE}), transparent 100%)`),
    ],
    ['nc-scroll-fade-top', maskImage(`linear-gradient(transparent 0%, black ${FADE_SIZE}, black 100%)`)],
    ['nc-scroll-fade-bottom', maskImage(`linear-gradient(black 0%, black calc(100% - ${FADE_SIZE}), transparent 100%)`)],
  ],
})

export default ncScreenPreset

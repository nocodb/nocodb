import { defineConfig, presetTypography, presetWind3, transformerDirectives, transformerVariantGroup } from 'unocss'
import { colors as unoColors } from '@unocss/preset-mini/colors'
import { presetForms } from '@julr/unocss-preset-forms'

import { ncApplyTransformer } from './assets/nc-apply-transformer'
import { ncPreflightPreset } from './assets/nc-preflight-preset'
import { ncTypographyPreset } from './assets/nc-typography-preset'
import { ncScreenPreset } from './assets/nc-screen-preset'
import { ncScrollbarPreset } from './assets/nc-scrollbar-preset'

import {
  theme as colors,
  ncBuildColorsWithOpacity,
  themeColors,
  themeV2Colors,
  themeV3Colors,
  themeV4Colors,
  themeVariables,
} from './utils/colorsUtils'

export default defineConfig({
  // Matched against absolute module ids, so one list covers both the CE build and the
  // EE build (rootDir=./ee) without the ../ prefixing WindiCSS's filesystem globs needed.
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        // plain .ts modules that assemble class names in string literals
        /composables\/useColumnFilteredOrSorted\.ts($|\?)/,
        /components\/smartsheet\/header\/[^/]+\.ts($|\?)/,
        /components\/smartsheet\/grid\/canvas\/cells\/.+\.ts($|\?)/,
        /utils\/cssUtils\.ts($|\?)/,
      ],
      exclude: [/node_modules/, /\.git\//, /\.nuxt\//, /\.output\//],
    },
  },

  // ncApplyTransformer rewrites the 5.5k inherited `@apply` directives to `--at-apply` before
  // sass runs; transformerDirectives then expands them once sass has produced valid CSS.
  transformers: [ncApplyTransformer(), transformerDirectives(), transformerVariantGroup()],

  presets: [
    ncPreflightPreset(),
    // Ahead of presetWind3 deliberately: UnoCSS orders a layer by rule index, so this is what keeps
    // `.font-bold` beating `.text-body` on font-weight, as WindiCSS's `components` layer did.
    ncTypographyPreset(),
    presetWind3({ dark: 'class', preflight: true }),
    presetTypography(),
    // 'class' keeps the element-level base out: its bare-input selector and :focus outline
    // are the two things WindiCSS's forms plugin never emitted.
    presetForms({ strategy: 'class' }),
    ncScreenPreset(),
    ncScrollbarPreset(),
  ],

  safelist: [
    'text-yellow-500',
    'text-sky-500',
    'text-red-500',
    'bg-primary-selected',
    'text-pink-500',
    'text-orange-500',
    'text-blue-500',
    'text-purple-500',
    'text-grey',
  ],

  // Class strings built with template literals (`h-[${height}]`) reach the extractor verbatim.
  // WindiCSS discarded such candidates; UnoCSS accepts them and emits `height: ${height}`,
  // which fails the postcss pass. The runtime value was never a pre-generated utility either
  // way, so dropping the candidate keeps these classes inert exactly as before.
  // NcButton/NcSelect etc. carry their t-shirt size as a semantic class (`size-xs`) that their own
  // CSS styles. WindiCSS had no `size-*` shorthand so nothing was emitted; presetWind3 resolves it
  // against the maxWidth scale and emits `width/height: 20rem`, which the component rules never
  // override for width — every `size="xs"` button rendered 320px wide.
  blocklist: [/\$\{/, /^size-(xs|sm|md|lg|xl)$/],

  variants: [
    // WindiCSS exposed `xs` as a max-width:480px breakpoint. UnoCSS breakpoints are
    // min-width only, and `lt-sm:` would resolve to 479.9px, so keep `xs:` faithful.
    (matcher) => {
      if (!matcher.startsWith('xs:')) return
      return {
        matcher: matcher.slice(3),
        parent: '@media (max-width: 480px)',
      }
    },
  ],

  // WindiCSS emitted bracket utilities after the static scale, so `h-full … h-[1px]` on one
  // element resolved to 1px. Both are one class, so the tie falls to source order, and UnoCSS
  // emits the bracket one first. A variant `sort` only reorders within a single rule — UnoCSS
  // sorts by rule index first — so `grid-cols-2`/`grid-cols-[1fr_2fr]` and pseudo-class pairs
  // would still miss; a layer is what puts every bracket utility last.
  layers: { 'nc-arbitrary': 1 },

  // Keyed off the escaped selector, not the candidate: a shortcut that expands to a bracket
  // value (`nc-content-max-w`) has none in its own selector and stays in the shortcuts layer.
  postprocess: [
    (util) => {
      if (util.selector?.includes('\\[')) util.layer = 'nc-arbitrary'
    },
  ],

  rules: [
    // WindiCSS scoped this to borderColor only; `text-error`/`bg-error` still use themeColors.error.
    ['border-error', { 'border-color': 'var(--ant-error-color)' }],

    // WindiCSS had a `font-weight-*` utility that presetWind3 does not. It looked the segment up
    // in `theme.fontWeight` — so the Inter remap applies (`-550` → 450, `-medium` → 600) — and
    // fell back to a literal number. `default` is deliberately excluded: WindiCSS missed it in
    // fontWeight and matched `fontFamily.default`, emitting the app's base font-family instead.
    [
      /^font-weight-(.+)$/,
      ([, key], { theme }) => {
        if (key === 'default') return
        const value = (theme as any).fontWeight?.[key] ?? (/^\d+$/.test(key) ? key : undefined)

        if (value) return { 'font-weight': value }
      },
    ],

    // Tailwind v2 spellings that WindiCSS still accepted but presetWind3 renamed.
    ['overflow-ellipsis', { 'text-overflow': 'ellipsis' }],
    ['decoration-clone', { 'box-decoration-break': 'clone' }],

    // `rounded-x-*` / `rounded-y-*` and `outline-<side>-*` only exist in WindiCSS, and it
    // ignored the axis/side — both emit the un-scoped property. Reproduced rather than
    // corrected, so the sidebar outline and calendar corners render as they do today.
    [
      /^rounded-[xy]-(.+)$/,
      ([, size], { theme }) => {
        const value = (theme as any).borderRadius?.[size]

        if (value) return { 'border-radius': value }
      },
    ],
    [
      /^outline-[trbl]-(.+)$/,
      ([, size], { theme }) => {
        const value = (theme as any).lineWidth?.[size] ?? (/^\d+$/.test(size) ? `${size}px` : undefined)

        if (value) return { 'outline-width': value }
      },
    ],

    // From @windicss/plugin-animations, which has no UnoCSS equivalent. Only these three of its
    // utilities are used, always alongside presetWind3's own `animate-spin`/`-pulse`/`-ping`.
    // `animate-fadeIn` sets only the name — the shorthand presetWind3's `theme.animation.keyframes`
    // would emit resets animation-fill-mode, which `animate-animated` is there to supply.
    ['animate-infinite', { 'animation-iteration-count': 'infinite' }],
    ['animate-animated', { 'animation-duration': '1000ms', 'animation-fill-mode': 'both' }],
    ['animate-fadeIn', { 'animation-name': 'fadeIn' }],
  ],

  shortcuts: {
    'color-transition': 'transition-colors duration-100 ease-in',
    'scrollbar-thin-primary':
      'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-base-white',
    'scrollbar-thin-dull':
      'scrollbar scrollbar-thin scrollbar-thumb-rounded-md scrollbar-thumb-nc-gray-100 scrollbar-track-base-white',
    'nc-scrollbar-thin':
      'scrollbar scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-500 hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-600 scrollbar-track-transparent',
    'nc-content-max-w': 'max-w-[97.5rem]',
    // UnoCSS declines negative zero, WindiCSS emitted `margin-left: 0px`. A rule cannot claim
    // this: the leading `-` is consumed as the negation marker before rules are matched.
    '-ml-0': 'ml-0',
  },

  preflights: [
    {
      // Paired with the `animate-fadeIn` rule above; @windicss/plugin-animations supplied these.
      getCSS: () => '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }',
    },
    {
      // Chromium 121+ honours `scrollbar-width: thin` and ignores ::-webkit-scrollbar,
      // falling back to the OS overlay bar that only shows on hover. This variant sets
      // no scrollbar-width and reserves the lane, keeping a always-visible custom bar.
      getCSS: () => `
.nc-scrollbar-visible { scrollbar-gutter: stable; }
.nc-scrollbar-visible::-webkit-scrollbar { width: 6px; height: 6px; }
.nc-scrollbar-visible::-webkit-scrollbar-track { background: transparent; }
.nc-scrollbar-visible::-webkit-scrollbar-thumb { border-radius: 9999px; background-color: rgba(156, 163, 175, 0.7); }
.nc-scrollbar-visible::-webkit-scrollbar-thumb:hover { background-color: rgba(107, 114, 128, 0.9); }
`,
    },
  ],

  theme: {
    fontFamily: {
      inter: 'Inter, Manrope, sans-serif',
      sans: 'Vazirmatn, sans-serif',
      serif: 'Vazirmatn, serif',
      mono: 'Inter, mono',
      default: 'Inter, Manrope, sans-serif',
    },

    breakpoints: {
      'sm': '480px',
      'md': '820px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1780px',
      '3xl': '1920px',
      '4xl': '2560px',
      '5xl': '3200px',
    },

    fontSize: {
      tiny: ['11px', '14px'],
      small: ['13px', '16px'],
      small1: ['13px', '18px'],
    },

    /**
     * In `Inter` font multiple of 100 will point to -100
     * @example
     * 1. 500 is equal to 400
     * 2. 600 is equal to 500
     * 3. 700 is equal to 600
     * 4. 800 is equal to 700
     * 5. 900 is equal to 800
     *
     * But if it is multiples of 100 plus 50 (350,450,550,650,750) then it be standard one
     * So while using it we have to use it like `Weight - 100`
     */
    fontWeight: {
      thin: '200',
      extraLight: '300',
      light: '400',
      normal: '500',
      default: '500',
      medium: '600',
      semibold: '550',
      bold: '700',
      black: '800',
      450: '400',
      550: '450',
      650: '550',
      750: '650',
      850: '750',
      950: '850',
    },

    boxShadow: {
      'default': '0px 0px 4px 0px rgba(var(--rgb-base), 0.08)',
      'hover': '0px 0px 4px 0px rgba(var(--rgb-base), 0.24)',
      'selected': '0px 0px 0px 2px var(--ant-primary-color-outline)',
      'selected-ai': '0px 0px 0px 2px rgba(125, 38, 205, 0.24)',
      'error': '0px 0px 0px 2px var(--ant-error-color-outline)',
      'focus': '0px 0px 0px 2px var(--nc-bg-default), 0px 0px 0px 4px var(--nc-fill-primary)',
      'nc-sm': '0px 3px 1px -2px rgba(var(--rgb-base), 0.06), 0px 5px 3px -2px rgba(var(--rgb-base), 0.02)',
      'disabled': '0 0 0 2px rgba(106, 113, 132, 0.24)',
    },

    colors: {
      ...unoColors,
      ...themeColors,
      ...themeV2Colors,
      ...themeV3Colors,
      ...ncBuildColorsWithOpacity(themeV4Colors, 'nc'),
      ...ncBuildColorsWithOpacity(themeVariables.content),
      ...ncBuildColorsWithOpacity(themeVariables.border),
      ...ncBuildColorsWithOpacity(themeVariables.background),
      ...ncBuildColorsWithOpacity(themeVariables.fill),
      ...ncBuildColorsWithOpacity({
        primary: '--color-primary',
        accent: '--color-accent',
      }),
      dark: colors.dark,
      light: colors.light,
    },
  },
})

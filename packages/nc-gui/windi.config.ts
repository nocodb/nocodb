import { defineConfig } from 'windicss/helpers'
import formsPlugin from 'windicss/plugin/forms'
import typographyPlugin from 'windicss/plugin/typography'
import aspectRatioPlugin from 'windicss/plugin/aspect-ratio'
import lineClampPlugin from 'windicss/plugin/line-clamp'
import windiColors from 'windicss/colors'
// @ts-expect-error no types for plugin-scrollbar
import scrollbar from '@windicss/plugin-scrollbar'
// @ts-expect-error no types for plugin-animation
import animations from '@windicss/plugin-animations'
// @ts-expect-error no types for plugin-question-mark
import questionMark from '@windicss/plugin-question-mark'

import { theme as colors, themeColors, themeV2Colors, themeV3Colors, themeVariables } from './utils/colorsUtils'

const isEE = process.env.EE

export default defineConfig({
  extract: {
    include: [
      ...(isEE
        ? [
            '../**/*.{vue,html,jsx,tsx,css,scss}',
            '../extensions/**/*.md',
            '../composables/useColumnFilteredOrSorted.ts',
            '../components/smartsheet/grid/canvas/cells/*.ts',
            '../components/smartsheet/grid/canvas/cells/**/*.ts',
          ]
        : [
            '**/*.{vue,html,jsx,tsx,css,scss}',
            'extensions/**/*.md',
            'composables/useColumnFilteredOrSorted.ts',
            'components/smartsheet/grid/canvas/cells/*.ts',
            'components/smartsheet/grid/canvas/cells/**/*.ts',
          ]),
    ],
    exclude: ['node_modules', '.git'],
  },

  darkMode: 'class',
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
  plugins: [
    scrollbar,
    animations,
    questionMark,
    formsPlugin,
    typographyPlugin({
      dark: true,
    }),
    aspectRatioPlugin,
    lineClampPlugin,
  ],

  preflight: {
    alias: {
      'nuxt-link': 'a',
      'nuxt-img': 'img',
    },
  },

  shortcuts: {
    'color-transition': 'transition-colors duration-100 ease-in',
    'scrollbar-thin-primary': 'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-white',
    'scrollbar-thin-dull': 'scrollbar scrollbar-thin scrollbar-thumb-rounded-md scrollbar-thumb-gray-100 scrollbar-track-white',
    'nc-scrollbar-thin':
      'scrollbar scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent',
    'nc-content-max-w': 'max-w-[97.5rem]',
  },

  theme: {
    fontFamily: {
      sans: ['Vazirmatn', 'sans-serif'],
      serif: ['Vazirmatn', 'serif'],
      mono: ['Inter', 'mono'],
    },
    extend: {
      screens: {
        'xs': {
          max: '480px',
        },
        'sm': {
          min: '480px',
        },
        'md': {
          min: '820px',
        },
        '2xl': {
          min: '1780px',
        },
      },
      fontSize: {
        'tiny': ['11px', '14px'],
        'small': ['13px', '16px'],
        'small1': ['13px', '18px'],
        'heading1': ['64px', { lineHeight: '92px', fontWeight: 700, letterSpacing: '-2%' }],
        'heading2': ['40px', { lineHeight: '64px', fontWeight: 700, letterSpacing: '-2%' }],
        'heading3': ['24px', { lineHeight: '36px', fontWeight: 700, letterSpacing: '-2%' }],
        'sub-heading1': ['20px', { lineHeight: '32px', fontWeight: 700, letterSpacing: '-2%' }],
        'sub-heading2': ['16px', { lineHeight: '24px', fontWeight: 700, letterSpacing: '-2%' }],
        'body-lg': ['16px', { lineHeight: '28px', fontWeight: 500, letterSpacing: '-2%' }],
        'body-lg-bold': ['16px', { lineHeight: '28px', fontWeight: 700, letterSpacing: '-2%' }],
        'body': ['14px', { lineHeight: '24px', fontWeight: 500, letterSpacing: '0%' }],
        'body-bold': ['14px', { lineHeight: '24px', fontWeight: 700, letterSpacing: '0%' }],
        'body-default-sm': ['13px', { lineHeight: '18px', fontWeight: 500, letterSpacing: '0%' }],
        'body-default-sm-bold': ['13px', { lineHeight: '18px', fontWeight: 700, letterSpacing: '0%' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: 500, letterSpacing: '0%' }],
        'body-sm-bold': ['12px', { lineHeight: '18px', fontWeight: 700, letterSpacing: '0%' }],
        'caption': ['14px', { lineHeight: '20px', fontWeight: 500, letterSpacing: '0%' }],
        'caption-bold': ['14px', { lineHeight: '20px', fontWeight: 700, letterSpacing: '0%' }],
        'caption-sm': ['12px', { lineHeight: '14px', fontWeight: 500, letterSpacing: '0%' }],
        'caption-sm-bold': ['12px', { lineHeight: '14px', fontWeight: 700, letterSpacing: '0%' }],
        'caption-xs': ['10px', { lineHeight: '14px', fontWeight: 500, letterSpacing: '0%' }],
        'caption-xs-bold': ['10px', { lineHeight: '14px', fontWeight: 700, letterSpacing: '0%' }],
        'caption-dropdown-default': ['13px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
        'sidebar-default': ['14px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
        'sidebar-selected': ['14px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
      },
      fontWeight: {
        thin: 150,
        extraLight: 250,
        light: 350,
        normal: 450,
        default: 500,
        medium: 550,
        bold: 650,
        black: 750,
      },
      textColor: {
        primary: 'rgba(var(--color-primary), var(--tw-text-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-text-opacity))',
      },
      borderColor: {
        primary: 'rgba(51, 102, 255, 1)',
        accent: 'rgba(var(--color-accent), var(--tw-border-opacity))',
        error: 'var(--ant-error-color)',
      },
      backgroundColor: {
        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
      },
      ringColor: {
        primary: 'rgba(var(--color-primary), var(--tw-ring-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-ring-opacity))',
      },
      boxShadow: {
        'default': '0px 0px 4px 0px rgba(0, 0, 0, 0.08)',
        'hover': '0px 0px 4px 0px rgba(0, 0, 0, 0.24)',
        'selected': '0px 0px 0px 2px var(--ant-primary-color-outline)',
        'selected-ai': '0px 0px 0px 2px rgba(125, 38, 205, 0.24)',
        'error': '0px 0px 0px 2px var(--ant-error-color-outline)',
        'focus': '0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe',
        'nc-sm': '0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02)',
      },
      colors: {
        ...windiColors,
        ...themeColors,
        ...themeV2Colors,
        ...themeV3Colors,
        ...themeVariables.content,
        ...themeVariables.border,
        ...themeVariables.background,
        ...themeVariables.fill,
        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

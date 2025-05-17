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
      inter: ['Inter', 'Manrope', 'sans-serif'],
      sans: ['Vazirmatn', 'sans-serif'],
      serif: ['Vazirmatn', 'serif'],
      mono: ['Inter', 'mono'],
      default: ['Inter', 'Manrope', 'sans-serif'],
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
        'subHeading1': ['20px', { lineHeight: '32px', fontWeight: 700, letterSpacing: '-2%' }],
        'subHeading2': ['16px', { lineHeight: '24px', fontWeight: 700, letterSpacing: '-2%' }],
        'bodyLg': ['16px', { lineHeight: '28px', fontWeight: 500, letterSpacing: '-2%' }],
        'bodyLgBold': ['16px', { lineHeight: '28px', fontWeight: 700, letterSpacing: '-2%' }],
        'body': ['14px', { lineHeight: '24px', fontWeight: 500, letterSpacing: '0%' }],
        'bodyBold': ['14px', { lineHeight: '24px', fontWeight: 700, letterSpacing: '0%' }],
        'bodyDefaultSm': ['13px', { lineHeight: '18px', fontWeight: 500, letterSpacing: '0%' }],
        'bodyDefaultSmBold': ['13px', { lineHeight: '18px', fontWeight: 700, letterSpacing: '0%' }],
        'bodySm': ['12px', { lineHeight: '18px', fontWeight: 500, letterSpacing: '0%' }],
        'bodySmBold': ['12px', { lineHeight: '18px', fontWeight: 700, letterSpacing: '0%' }],
        'caption': ['14px', { lineHeight: '20px', fontWeight: 500, letterSpacing: '0%' }],
        'captionBold': ['14px', { lineHeight: '20px', fontWeight: 700, letterSpacing: '0%' }],
        'captionSm': ['12px', { lineHeight: '14px', fontWeight: 500, letterSpacing: '0%' }],
        'captionSmBold': ['12px', { lineHeight: '14px', fontWeight: 700, letterSpacing: '0%' }],
        'captionXs': ['10px', { lineHeight: '14px', fontWeight: 500, letterSpacing: '0%' }],
        'captionXsBold': ['10px', { lineHeight: '14px', fontWeight: 700, letterSpacing: '0%' }],
        'captionDropdownDefault': ['13px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
        'sidebarDefault': ['14px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
        'sidebarSelected': ['14px', { lineHeight: '20px', fontWeight: 650, letterSpacing: '0%' }],
      },
      fontWeight: {
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
        thin: 200, // original 200
        extraLight: 300, // original 300
        light: 400, // original 400
        normal: 500, // original 400
        default: 500, // original 400
        medium: 600, // original 500
        semibold: 550, // original 550
        bold: 700, // original 600
        black: 800, // original 700
        450: 400,
        550: 450,
        650: 550,
        750: 650,
        850: 750,
        950: 850,
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

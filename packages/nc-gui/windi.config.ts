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

import { theme as colors, themeColors, themeV2Colors } from './utils/colorsUtils'

export default defineConfig({
  extract: {
    include: ['**/*.{vue,html,jsx,tsx,css,scss}'],
    exclude: ['node_modules', '.git'],
  },

  darkMode: 'class',
  safelist: ['text-yellow-500', 'text-sky-500', 'text-red-500', 'bg-primary-selected'],
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
    'color-transition': 'transition-color duration-100 ease-in',
    'scrollbar-thin-primary': 'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-white',
    'scrollbar-thin-dull': 'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-200 scrollbar-track-gray-50',
  },

  theme: {
    fontFamily: {
      sans: ['Vazirmatn', 'sans-serif'],
      serif: ['Vazirmatn', 'serif'],
      mono: ['Inter', 'mono'],
    },
    extend: {
      textColor: {
        primary: 'rgba(var(--color-primary), var(--tw-text-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-text-opacity))',
      },
      borderColor: {
        primary: 'rgba(var(--color-primary), var(--tw-border-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-border-opacity))',
      },
      backgroundColor: {
        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
      },
      ringColor: {
        primary: 'rgba(var(--color-primary), var(--tw-ring-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-ring-opacity))',
      },
      colors: {
        ...windiColors,
        ...themeColors,
        ...themeV2Colors,
        gray: {
          50: '#F9FAFB',
          75: '#EDEDED',
          100: '#E1E3E6',
          200: '#C4C7CC',
          300: '#A6AAB3',
          400: '#898E99',
          500: '#6B7280',
          600: '#565B66',
          700: '#40444D',
          800: '#2B2E33',
          900: '#15171A',
        },
        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

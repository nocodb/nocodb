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

const isEE = process.env.EE

export default defineConfig({
  extract: {
    include: [isEE ? '../**/*.{vue,html,jsx,tsx,css,scss}' : '**/*.{vue,html,jsx,tsx,css,scss}'],
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
    'scrollbar-thin-dull': 'scrollbar scrollbar-thin scrollbar-thumb-rounded-md scrollbar-thumb-gray-100 scrollbar-track-white',
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
        primary: 'rgba(51, 102, 255, 1)',
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
        brand: {
          50: '#EBF0FF',
          100: '#D6E0FF',
          200: '#ADC2FF',
          300: '#85A3FF',
          400: '#5C85FF',
          500: '#36F',
          600: '#2952CC',
          700: '#1F3D99',
          800: '#142966',
          900: '#0A1433',
        },
        gray: {
          10: '#FCFCFC',
          50: '#F9F9FA',
          100: '#F4F4F5',
          200: '#E7E7E9',
          300: '#D5D5D9',
          400: '#9AA2AF',
          500: '#6A7184',
          600: '#4A5268',
          700: '#374151',
          800: '#1F293A',
          900: '#101015',
        },
        red: {
          50: '#FFF2F1',
          100: '#FFDBD9',
          200: '#FFB7B2',
          300: '#FF928C',
          400: '#FF6E65',
          500: '#FF4A3F',
          600: '#E8463C',
          700: '#CB3F36',
          800: '#B23830',
          900: '#7D2721',
        },
        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

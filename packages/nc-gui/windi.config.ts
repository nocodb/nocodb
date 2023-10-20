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
      fontWeight: {
        thin: 150,
        extraLight: 250,
        light: 350,
        normal: 450,
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
          500: '#3366FF',
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
        pink: {
          50: '#FFEEFB',
          100: '#FED8F4',
          200: '#FEB0E8',
          300: '#FD89DD',
          400: '#FD61D1',
          500: '#FC3AC6',
          600: '#CA2E9E',
          700: '#972377',
          800: '#65174F',
          900: '#320C28',
        },
        orange: {
          50: '#FFF5EF',
          100: '#FEE6D6',
          200: '#FDCDAD',
          300: '#FCB483',
          400: '#FB9B5A',
          500: '#FA8231',
          600: '#E1752C',
          700: '#C86827',
          800: '#964E1D',
          900: '#4B270F',
        },
        purple: {
          50: '#F3ECFA',
          100: '#E5D4F5',
          200: '#CBA8EB',
          300: '#B17DE1',
          400: '#9751D7',
          500: '#7D26CD',
          600: '#641EA4',
          700: '#4B177B',
          800: '#320F52',
          900: '#190829',
        },
        blue: {
          50: '#EDF9FF',
          100: '#D7F2FF',
          200: '#AFE5FF',
          300: '#86D9FF',
          400: '#5ECCFF',
          500: '#36BFFF',
          600: '#2B99CC',
          700: '#207399',
          800: '#164C66',
          900: '#0B2633',
        },
        yellow: {
          50: '#fffbf2',
          100: '#fff0d1',
          200: '#fee5b0',
          300: '#fdd889',
          400: '#fdcb61',
          500: '#fcbe3a',
          600: '#ca982e',
          700: '#977223',
          800: '#654c17',
          900: '#32260c',
        },
        maroon: {
          50: '#FFF0F7',
          100: '#FFCFE6',
          200: '#FFABD2',
          300: '#EC7DB1',
          400: '#D45892',
          500: '#B33771',
          600: '#9D255D',
          700: '#801044',
          800: '#690735',
          900: '#42001F',
        },

        primary: 'rgba(var(--color-primary), var(--tw-bg-opacity))',
        accent: 'rgba(var(--color-accent), var(--tw-bg-opacity))',
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

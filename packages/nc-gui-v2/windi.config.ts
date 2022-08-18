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

import { theme as colors, themeColors } from './utils/colorsUtils'

export default defineConfig({
  extract: {
    include: ['**/*.{vue,html,jsx,tsx,css,scss}'],
    exclude: ['node_modules', '.git'],
  },

  darkMode: 'class',

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
    'scrollbar-thin-primary':
      'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-white dark:(!scrollbar-track-black)',
    'scrollbar-thin-dull':
      'scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300 scrollbar-track-white dark:(!scrollbar-track-black)',
  },

  theme: {
    fontFamily: {
      sans: ['Vazirmatn', 'sans-serif'],
      serif: ['Vazirmatn', 'serif'],
      mono: ['Roboto', 'mono'],
    },
    extend: {
      colors: {
        ...windiColors,
        ...themeColors,
        accent: windiColors.pink['500'],
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

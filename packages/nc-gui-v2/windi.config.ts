import { defineConfig } from 'windicss/helpers'
import formsPlugin from 'windicss/plugin/forms'
import typographyPlugin from 'windicss/plugin/typography'
import aspectRatioPlugin from 'windicss/plugin/aspect-ratio'
import lineClampPlugin from 'windicss/plugin/line-clamp'
import windiColors from 'windicss/colors'
// @ts-expect-error no types for plugin-scrollbar
import scrollbar from '@windicss/plugin-scrollbar'
import colors, { themeColors } from './utils/colorsUtils'

export default defineConfig({
  extract: {
    include: ['**/*.{vue,html,jsx,tsx}'],
    exclude: ['node_modules', '.git'],
  },

  attributify: true,
  darkMode: 'class',

  plugins: [scrollbar, formsPlugin, typographyPlugin, aspectRatioPlugin, lineClampPlugin],

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
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

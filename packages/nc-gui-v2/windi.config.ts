import { defineConfig } from 'windicss/helpers'
// @ts-expect-error no types for plugin-scrollbar
import scrollbar from '@windicss/plugin-scrollbar'
import colors from './utils/colorsUtils'

export default defineConfig({
  extract: {
    include: ['**/*.{vue,html,jsx,tsx}'],
    exclude: ['node_modules', '.git'],
  },

  attributify: true,
  darkMode: 'class',

  plugins: [scrollbar],

  theme: {
    extend: {
      colors: {
        dark: colors.dark,
        light: colors.light,
      },
    },
  },
})

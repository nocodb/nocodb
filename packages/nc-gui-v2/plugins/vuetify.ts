import type { ThemeDefinition } from 'vuetify'
import { createVuetify } from 'vuetify'
import { defineNuxtPlugin } from 'nuxt/app'

// todo: exclude unused components
// Import everything
import * as components from 'vuetify/components'

import { themeColors } from '~/utils/colorsUtils'

const ncLightTheme: ThemeDefinition = {
  dark: false,
  colors: themeColors,
}

export const createVuetifyPlugin = () =>
  createVuetify({
    components,
    theme: {
      defaultTheme: 'ncLightTheme',
      themes: {
        ncLightTheme,
      },
    },
  })

export default defineNuxtPlugin((nuxtApp) => {
  // nuxtApp.vueApp.use(createVuetifyPlugin())
})

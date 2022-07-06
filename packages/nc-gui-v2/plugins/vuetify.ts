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

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    theme: {
      defaultTheme: 'ncLightTheme',
      themes: {
        ncLightTheme,
      },
    },
  })
  nuxtApp.vueApp.use(vuetify)
})

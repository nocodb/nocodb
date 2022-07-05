import type { ThemeDefinition } from 'vuetify'
import { createVuetify } from 'vuetify'
import { defineNuxtPlugin } from 'nuxt/app'

// todo: exclude unused components
// Import everything
import * as components from 'vuetify/components'

const ncLightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    'background': '#FFFFFF',
    'surface': '#FFFFFF',
    'primary': '#1348ba',
    'secondary': '#03DAC6',
    'secondary-darken-1': '#018786',
    'error': '#B00020',
    'info': '#2196F3',
    'success': '#4CAF50',
    'warning': '#FB8C00',
  },
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

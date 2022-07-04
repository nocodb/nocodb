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
    // theme: {

    // dark: {
    //   primary: '#0989ff',
    //   // primary: '#0989ff',
    //   'x-active': '#e91e63',
    //   textColor: '#ffffff',
    //   text: '#ffffff',
    //   textLight: '#b3b3b3',
    //   backgroundColor: '#565656',
    //   backgroundColor1: '#252525',
    //   backgroundColorDefault: '#1f1f1f'
    // },
    // light: {
    //   'primary': '#1348ba',
    //   // primary: '#0989ff',
    //   'x-active': '#e91e63',
    //   'textColor': '#333333',
    //   'text': '#333333',
    //   'textLight': '#929292',
    //   'backgroundColor': '#f7f7f7',
    //   'backgroundColor1': '#f7f6f3',
    //   'backgroundColorDefault': '#ffffff',
    // },
    // },
  })
  nuxtApp.vueApp.use(vuetify)
})

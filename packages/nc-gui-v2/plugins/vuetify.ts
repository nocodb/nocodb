import { createVuetify } from 'vuetify'
import { defineNuxtPlugin } from 'nuxt/app'

// Import everything
import * as components from 'vuetify/components'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
  })
  nuxtApp.vueApp.use(vuetify)
})

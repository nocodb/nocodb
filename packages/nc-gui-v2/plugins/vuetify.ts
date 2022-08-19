import { createVuetify } from 'vuetify'
// import {
//   VApp,
//   VAppBar,
//   VBtn
// } from 'vuetify/components'
import {defineNuxtPlugin} from "nuxt/app";

// Import everything
import * as components from 'vuetify/components'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components/*: {
      VApp,
      VAppBar,
      VBtn*/
    // }
  })
  nuxtApp.vueApp.use(vuetify)
})

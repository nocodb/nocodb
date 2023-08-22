import VueQrcodeReader from 'vue-qrcode-reader'

import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueQrcodeReader)
})

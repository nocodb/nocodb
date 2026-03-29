import { defineNuxtPlugin } from 'nuxt/app'
import VueDOMPurifyHTML from 'vue-dompurify-html'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueDOMPurifyHTML)
})

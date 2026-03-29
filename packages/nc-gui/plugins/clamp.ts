import { defineNuxtPlugin } from 'nuxt/app'
import TextClamp from 'vue3-text-clamp'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(TextClamp)
})

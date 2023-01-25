import TextClamp from 'vue3-text-clamp'
import { defineNuxtPlugin } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(TextClamp)
})

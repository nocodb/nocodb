// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../'],

  imports: {
    dirs: ['./context', './utils/**', './lib', './composables/**', './store/**'],
  },
})

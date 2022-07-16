import {defineNuxtConfig} from 'nuxt'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  // modules: ['@nuxtjs/tailwindcss'],
  // buildModules: [
  //   'nuxt-vite'
  // ],
  modules: ['nuxt3-store'],
  ssr:false,
  plugins: [
    // '~/plugins/vuetify.ts',
    // '~/plugins/api.ts',
  ],
  css: ['vuetify/lib/styles/main.sass'],
  build: {
    transpile: ['vuetify']
  },

  // css: [
  //   'primevue/resources/themes/saga-blue/theme.css',
  //   'primevue/resources/primevue.css',
  //   'primeicons/primeicons.css',
  //   'primeflex/primeflex.css',
  // ],
  // build: {
  //   transpile: ['primevue']
  // },

  vite: {
    define: {
      'process.env.DEBUG': 'false',
    }
  }
})

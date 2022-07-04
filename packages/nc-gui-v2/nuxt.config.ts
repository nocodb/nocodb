import { defineNuxtConfig } from 'nuxt'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: ['nuxt3-store'],
  ssr: false,
  css: ['vuetify/lib/styles/main.sass'],
  build: {
    transpile: ['vuetify'],
  },

  meta: {
    title: 'NocoDB',
    description: 'NocoDB GUI V2',
    titleTemplate: (titleChunk) => {
      // If undefined or blank then we don't need the hyphen
      return titleChunk ? `${titleChunk} - NocoDB` : 'NocoDB'
    },
  },

  vite: {
    define: {
      'process.env.DEBUG': 'false',
    },
  },
})

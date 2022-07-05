import path from 'path'
import { defineNuxtConfig } from 'nuxt'
import vueI18n from '@intlify/vite-plugin-vue-i18n'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt'],

  ssr: false,

  css: ['vuetify/lib/styles/main.sass'],

  build: {
    transpile: ['vuetify'],
  },

  meta: {
    title: 'NocoDB',
    description: 'NocoDB GUI V2',
    titleTemplate: (titleChunk: string) => {
      // If undefined or blank then we don't need the hyphen
      return titleChunk ? `${titleChunk} - NocoDB` : 'NocoDB'
    },
  },

  vite: {
    plugins: [
      vueI18n({
        include: path.resolve(__dirname, './lang'),
      }),
    ],
    define: {
      'process.env.DEBUG': 'false',
    },
  },

  experimental: {
    reactivityTransform: true,
    viteNode: false,
  },
})

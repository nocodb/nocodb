import path from 'path'
import { defineNuxtConfig } from 'nuxt'
import vueI18n from '@intlify/vite-plugin-vue-i18n'
import Icons from 'unplugin-icons/vite'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt', 'nuxt-windicss'],

  ssr: false,

  css: [
    'virtual:windi.css',
    'virtual:windi-devtools',
    'vuetify/lib/styles/main.sass',
    '~/assets/style/fonts.css',
    '~/assets/css/global.css',
    '~/assets/style/style.css',
    '~/assets/style.css',
  ],

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
      Icons({
        autoInstall: true,
        compiler: 'vue3',
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

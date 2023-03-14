import path from 'node:path'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

export default defineConfig({
  plugins: [
    // Vue(),
    VueI18nPlugin({
      include: path.resolve(__dirname, '../lang'),
    }),
    Icons({
      autoInstall: true,
      compiler: 'vue3',
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../'),
      '~': path.resolve(__dirname, '../'),
      '#app': path.resolve(__dirname, '../node_modules/nuxt/dist/app'),
      '#imports': path.resolve(__dirname, '../.nuxt/imports'),
    },
  },
})

/// <reference types="vitest" />

import path from 'path'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
    VueI18nPlugin({
      include: path.resolve(__dirname, '../lang'),
    }),
    Icons({
      autoInstall: true,
      compiler: 'vue3',
    }),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../'),
      '~': path.resolve(__dirname, '../'),
      '#app': path.resolve(__dirname, '../node_modules/nuxt/dist/app'),
      '#imports': path.resolve(__dirname, '../.nuxt/imports'),
    },
  },
})

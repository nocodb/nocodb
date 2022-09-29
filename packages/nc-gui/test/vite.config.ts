/// <reference types="vitest" />

import path from 'path'
import vueI18n from '@intlify/vite-plugin-vue-i18n'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    Vue(),
    vueI18n({
      include: path.resolve(__dirname, '../lang'),
    }),
    Icons({
      autoInstall: true,
      compiler: 'vue3',
    }),
  ],
  test: {
    setupFiles: path.resolve(__dirname, './vuetify.config.js'),
    deps: {
      inline: ['vuetify'],
    },
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

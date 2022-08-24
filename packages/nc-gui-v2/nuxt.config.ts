import path from 'path'
import { defineNuxtConfig } from 'nuxt'
import vueI18n from '@intlify/vite-plugin-vue-i18n'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt', 'nuxt-windicss', '@nuxt/image-edge'],


  ssr: false,
  app: {
    baseURL: '/dashboard/',
  },
  css: [
    'virtual:windi.css',
    'virtual:windi-devtools',
    '~/assets/style/fonts.css',
    '~/assets/css/global.css',
    '~/assets/style.scss',
  ],

  meta: {
    title: 'NocoDB',
    link: [
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: './favicon-32.png',
      },
    ],
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || '',
      },
    ],
  },

  vite: {
    // todo: minifiy again
    build: {

      minify: false,
      rollupOptions: {
        external: 'httpsnippet',

      },
    },
    plugins: [
      vueI18n({
        include: path.resolve(__dirname, './lang'),
        runtimeOnly: false,
      }),
      Icons({
        autoInstall: true,
        compiler: 'vue3',
        defaultClass: 'nc-icon',
      }),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: false,
            resolveIcons: false,
          }),
          IconsResolver({
            prefix: false,
          }),
        ],
      }),
      monacoEditorPlugin({
        languageWorkers: ['json'],
      }),
    ],
    define: {
      'process.env.DEBUG': 'false',
    },
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
  experimental: {
    reactivityTransform: true,
  },

  image: {
    dir: 'assets/',
  },
  autoImports: {
    dirs: ['./context', './utils', './lib'],
    imports: [{ name: 'useI18n', from: 'vue-i18n' }],
  },

  pageTransition: {
    name: 'page',
    mode: 'out-in',
  },
  layoutTransition: {
    name: 'layout',
    mode: 'out-in',
  },
})

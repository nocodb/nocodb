import { dirname, resolve } from 'node:path'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

import PurgeIcons from 'vite-plugin-purge-icons'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@vueuse/nuxt', 'nuxt-windicss', '@nuxt/image-edge', '@pinia/nuxt'],

  ssr: false,
  router: {
    options: {
      hashMode: true,
    },
  },
  spaLoadingTemplate: false,
  app: {
    pageTransition: process.env.NUXT_PAGE_TRANSITION_DISABLE
      ? false
      : {
          name: 'page',
          mode: 'out-in',
        },
    // layoutTransition: process.env.NUXT_PAGE_TRANSITION_DISABLE
    //   ? false
    //   : {
    //       name: 'layout',
    //       mode: 'out-in',
    //     },
    // todo: enable it back after fixing the issue with layout transition
    layoutTransition: false,

    /** In production build we need to load assets using relative path, to achieve the result we are using cdnURL */
    cdnURL: process.env.NODE_ENV === 'production' ? process.env.NC_CDN_URL || '.' : undefined,
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: './favicon.ico',
        },

        ...(process.env.NC_CDN_URL
          ? [
              {
                rel: 'preload',
                as: 'font',
                href: new URL('/shared/style/material.woff2', process.env.NC_CDN_URL).href,
                type: 'font/woff2',
                crossorigin: 'anonymous',
              } as any,
              { rel: 'stylesheet', href: new URL('/shared/style/fonts.css', process.env.NC_CDN_URL).href },
            ]
          : []),
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
        // Open Graph
        { hid: 'og:site_name', property: 'og:site_name', content: 'NocoDB' },
        { hid: 'og:type', property: 'og:type', content: 'website' },
        { hid: 'og:title', property: 'og:title', content: 'NocoDB' },
        {
          hid: 'og:description',
          property: 'og:description',
          content:
            'NocoDB provides an intuitive spreadsheet interface for creating online databases, either from scratch or by connecting to any Postgres/MySQL. Access your data through interactive UIs or via API and SQL. Get started for free.',
        },
        { hid: 'og:url', property: 'og:url', content: 'https://nocodb.com' },
        // Twitter
        { hid: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
        { hid: 'twitter:title', name: 'twitter:title', content: 'NocoDB' },
        {
          hid: 'twitter:description',
          name: 'twitter:description',
          content:
            'NocoDB provides an intuitive spreadsheet interface for creating online databases, either from scratch or by connecting to any Postgres/MySQL. Access your data through interactive UIs or via API and SQL. Get started for free.',
        },
        {
          hid: 'twitter:image',
          name: 'twitter:image',
          content: './link-preview.webp',
        },
        {
          hid: 'og:image',
          property: 'og:image',
          content: './link-preview.webp',
        },
      ],
    },
  },

  css: [
    ...(process.env.NC_CDN_URL ? [] : ['~/assets/style/fonts.css']),
    'virtual:windi.css',
    'virtual:windi-devtools',
    '~/assets/css/global.css',
    '~/assets/style.scss',
  ],

  runtimeConfig: {
    public: {
      ncBackendUrl: '',
    },
  },

  build: {},

  vite: {
    worker: {
      format: 'es',
    },
    build: {
      commonjsOptions: {
        ignoreTryCatch: true,
      },
      minify: true,
      rollupOptions: {},
    },
    plugins: [
      VueI18nPlugin({
        include: [resolve(dirname('./lang/*.json'))],
        runtimeOnly: false,
      }),
      Icons({
        autoInstall: false,
        compiler: 'vue3',
        defaultClass: 'nc-icon',
        customCollections: {
          'nc-icons': FileSystemIconLoader('./assets/nc-icons', (svg) =>
            svg.replace(/^<svg (?!=\s*data-ignore)/, '<svg stroke="currentColor" '),
          ),
        },
      }),
      Components({
        resolvers: [
          AntDesignVueResolver({
            importStyle: false,
            resolveIcons: false,
          }),
          IconsResolver({
            prefix: false,
            enabledCollections: [
              'ant-design',
              'bi',
              'cil',
              'clarity',
              'eva',
              'ic',
              'logos',
              'lucide',
              'material-symbols',
              'mdi',
              'mi',
              'ph',
              'ri',
              'system-uicons',
              'vscode-icons',
              'simple-icons',
              'nc-icons',
              'ion',
              'tabler',
              'carbon',
            ],
          }),
        ],
      }),
      monacoEditorPlugin({
        languageWorkers: ['json'],
        // customWorkers: [{ label: 'sql', entry: 'monaco-sql-languages/out/esm/sql/sql.worker.js' }],
        customDistPath: (root: string, buildOutDir: string) => {
          return `${buildOutDir}/` + `monacoeditorwork`
        },
      }),
      PurgeIcons({
        /* PurgeIcons Options */
        includedCollections: ['emojione'],
      }),
    ],
    define: {
      'process.env.DEBUG': 'false',
      'process.nextTick': () => {},
      'process.env.ANT_MESSAGE_DURATION': process.env.ANT_MESSAGE_DURATION,
    },
    server: {
      watch: {
        usePolling: true,
      },
    },
    resolve: {
      alias: {
        querystring: 'rollup-plugin-node-polyfills/polyfills/qs',
        util: 'rollup-plugin-node-polyfills/polyfills/util',
        url: 'rollup-plugin-node-polyfills/polyfills/url',
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
        // Enable esbuild polyfill plugins
        plugins: [NodeModulesPolyfillPlugin()],
      },
    },
  },

  experimental: {
    reactivityTransform: true,
  },

  image: {
    dir: 'assets/',
  },

  imports: {
    dirs: ['./context', './utils/**', './lib', './composables/**', './store/**'],
    imports: [
      { name: 'useI18n', from: 'vue-i18n' },
      { name: 'message', from: 'ant-design-vue/es' },
      { name: 'Modal', from: 'ant-design-vue/es' },
      { name: 'Empty', from: 'ant-design-vue/es' },
      { name: 'Form', from: 'ant-design-vue/es' },
      { name: 'useJwt', from: '@vueuse/integrations/useJwt' },
      { name: 'storeToRefs', from: 'pinia' },
    ],
  },
})

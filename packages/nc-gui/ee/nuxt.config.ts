import { dirname, resolve } from 'node:path'
import vueI18n from '@intlify/unplugin-vue-i18n/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'
import { sentryVitePlugin } from '@sentry/vite-plugin'

import PurgeIcons from 'vite-plugin-purge-icons'

// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  extends: ['../'],
  future: {
    compatibilityVersion: 4,
  },
  experimental: {
    componentIslands: false,
  },
  modules: ['nuxt-echarts', '@vueuse/nuxt', 'nuxt-windicss', '@nuxt/image', '@pinia/nuxt', '@productdevbook/chatwoot'],
  echarts: {
    renderer: ['canvas'],
    charts: ['BarChart', 'LineChart', 'PieChart'],
    components: ['DatasetComponent', 'GridComponent', 'TooltipComponent', 'TitleComponent', 'LegendComponent'],
    ssr: false,
  },
  ssr: false,
  alias: {
    '@': resolve(__dirname),
  },
  chatwoot: {
    init: {
      websiteToken: process.env.NUXT_CHATWOOT_WEBSITE_TOKEN,
      baseUrl: 'https://app.chatwoot.com',
    },
    settings: {
      darkMode: 'light',
      hideMessageBubble: true,
    },
  },
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
              { rel: 'stylesheet', href: new URL('/shared/style/fonts-new.css', process.env.NC_CDN_URL).href },
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
          content: process.env.NC_CDN_URL
            ? new URL('/shared/public/link-preview.webp', process.env.NC_CDN_URL).href
            : './link-preview.webp',
        },
        {
          hid: 'og:image',
          property: 'og:image',
          content: process.env.NC_CDN_URL
            ? new URL('/shared/public/link-preview.webp', process.env.NC_CDN_URL).href
            : './link-preview.webp',
        },
      ],
    },
  },

  css: [
    ...(process.env.NC_CDN_URL ? [] : ['~/assets/style/fonts-new.css']),
    'virtual:windi.css',
    'virtual:windi-devtools',
    '~/assets/css/global.css',
    '~/assets/style.scss',
    '~/assets/css/theme-overrides.scss',
    'vue-json-pretty/lib/styles.css',
  ],

  runtimeConfig: {
    public: {
      ncBackendUrl: '',
      env: 'production',
      // Config Endpoint for fetching various config from the server
      // Used for Downtime alerts
      configServerUrl: process.env.NUXT_NC_CONFIG_ENDPOINT,
      maxPageDesignerTableRows: 100,
    },
  },
  sourcemap: process.env.NC_ON_PREM !== 'true',
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
      vueI18n({
        include: [resolve(dirname('./lang/en.json'))],
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
          'nc-icons-v2': FileSystemIconLoader('./assets/nc-icons-v2', (svg) =>
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
      PurgeIcons({
        /* PurgeIcons Options */
        includedCollections: ['emojione'],
      }),

      // Sentry vite plugin for sourcemaps
      ...(process.env.SENTRY_AUTH_TOKEN
        ? [
            sentryVitePlugin({
              org: 'nocodb-6c',
              project: 'javascript',
              authToken: process.env.SENTRY_AUTH_TOKEN,
              telemetry: false,
            }),
          ]
        : []),
    ],
    define: {
      'process.env.DEBUG': 'false',
      'process.env.NC_ON_PREM': process.env.NC_ON_PREM ? JSON.stringify(process.env.NC_ON_PREM) : '"false"',
      'process.nextTick': 'globalThis.setImmediate',
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
      include: [
        '@ckpack/vue-color',
        '@tiptap/core',
        '@tiptap/extension-code',
        '@tiptap/extension-code-block',
        '@tiptap/extension-hard-break',
        '@tiptap/extension-italic',
        '@tiptap/extension-image',
        '@tiptap/extension-link',
        '@tiptap/extension-mention',
        '@tiptap/extension-placeholder',
        '@tiptap/extension-strike',
        '@tiptap/extension-table',
        '@tiptap/extension-table-row',
        '@tiptap/extension-table-header',
        '@tiptap/extension-table-cell',
        '@tiptap/extension-task-list',
        '@tiptap/extension-underline',
        '@tiptap/html',
        '@tiptap/pm/history',
        '@tiptap/pm/markdown',
        '@tiptap/pm/model',
        '@tiptap/pm/state',
        '@tiptap/pm/tables',
        '@tiptap/pm/transform',
        '@tiptap/pm/view',
        '@tiptap/starter-kit',
        '@tiptap/vue-3',
        '@vue-flow/additional-components',
        '@vue-flow/core',
        '@vuelidate/core',
        '@vuelidate/validators',
        '@vueuse/integrations/useQRCode',
        '@vvo/tzdb',
        'acorn-loose',
        'acorn-walk',
        'company-email-validator',
        'crossoriginworker',
        'd3-scale',
        'dagre',
        'dayjs/plugin/utc',
        'dayjs/plugin/timezone',
        'deep-object-diff',
        'diff',
        'embla-carousel-vue',
        'emoji-mart-vue-fast/src',
        'esbuild-wasm',
        'fflate',
        'file-saver',
        'fuse.js',
        '@readme/httpsnippet',
        'isomorphic-dompurify',
        'jsbarcode',
        'locale-codes',
        'markdown-it',
        'markdown-it-regexp',
        'markdown-it-task-lists',
        'marked',
        'mime-lite',
        'monaco-editor',
        'monaco-editor/esm/vs/basic-languages/javascript/javascript',
        'papaparse',
        'rehype-sanitize',
        'rehype-stringify',
        'remark-parse',
        'remark-rehype',
        'sortablejs',
        'splitpanes',
        'tippy.js',
        'tiptap-markdown',
        'turndown',
        'unified',
        'v3-infinite-loading',
        'validator',
        'validator/es/lib/isEmail',
        'validator/lib/isMobilePhone',
        'vue-advanced-cropper',
        'vue-barcode-reader',
        'vue-json-pretty',
        'vuedraggable',
        'xlsx',
        'youtube-vue3',
        'lru-cache',
        'qrcode',
        'validator',
        '@floating-ui/vue',
        'validator',
        '@stripe/stripe-js',
        'monacopilot',
        'esbuild-wasm',
        'typesense',
        'vue3-moveable',
        'vue-fullscreen',
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
        // Enable esbuild polyfill plugins
        plugins: [NodeModulesPolyfillPlugin()],
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },
  },

  // experimental props destructuring
  vue: {
    propsDestructure: true,
  },

  image: {
    dir: 'assets/',
  },

  imports: {
    dirs: ['./context', './utils/**', './lib/**', './composables/**', './store/**'],
  },

  compatibilityDate: '2024-12-04',
})

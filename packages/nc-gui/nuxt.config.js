import MonacoEditorWebpackPlugin from 'monaco-editor-webpack-plugin'

// import HtmlWebpackPlugin from 'html-webpack-plugin';
const fs = require('fs')
const packageJson = JSON.parse(fs.readFileSync('../nc-lib-gui/package.json', 'utf8'))
const version = packageJson.version
  .replace(/\.(\d+)$/, (_, v) => {
    // if (v === '99') throw new Error('Package version reached 99')
    return `.${++v}`
  })

export default {
  /*
  ** Nuxt rendering mode
  ** See https://nuxtjs.org/api/configuration-mode
  */
  mode: 'spa',
  // ssr: false,
  /*
  ** Nuxt target
  ** See https://nuxtjs.org/api/configuration-target
  */
  target: 'server',
  /*
  ** Headers of the page
  ** See https://nuxtjs.org/api/configuration-head
  */
  head: {
    titleTemplate: '',
    title: 'NocoDB',
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || ''
      }
    ],
    link: [
      {
        rel: 'icon',
        type: 'image/x-icon',
        href: './favicon-32.png'
      }
    ]
  },
  /*
  ** Global CSS
  */
  /*
  ** Plugins to load before mounting the App
  ** https://nuxtjs.org/guide/plugins
  */
  plugins: [
    { src: '~plugins/api.js' },
    '~/plugins/xutils.js',
    {
      src: '~plugins/localStorage.js',
      ssr: false
    },
    {
      src: '~plugins/confetti.js',
      ssr: false
    },
    {
      src: '~plugins/axiosInterceptor.js',
      ssr: false
    },
    '@/plugins/veeValidate',
    '@/plugins/vueTour',
    {
      src: '@/plugins/vueShortkey',
      ssr: false
    },
    '@/plugins/vueClipboard',
    '@/plugins/globalComponentLoader',
    '@/plugins/globalMixin',
    '@/plugins/globalEventBus',
    '@/plugins/ncApis',
    '~/plugins/i18n.js',
    {
      src: '~plugins/projectLoader.js',
      ssr: false
    },
    {
      src: '~/plugins/tele.js',
      ssr: false
    }
  ],
  /*
  ** Auto import components
  ** See https://nuxtjs.org/api/configuration-components
  */
  // components: true,
  /*
  ** Nuxt.js dev-modules
  */
  buildModules: [
    '@nuxtjs/vuetify'
  ],
  /*
  ** Nuxt.js modules
  */
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    '@nuxtjs/axios',
    'vue-github-buttons/nuxt',
    '@nuxtjs/toast'
  ],
  toast: {
    position: 'top-center'
  },
  /*
  ** Axios module configuration
  ** See https://axios.nuxtjs.org/options
  */
  axios: {
    baseURL: process.env.NC_BACKEND_URL || (process.env.NODE_ENV === 'production' ? '..' : 'http://localhost:8080')
  },
  /*
  ** vuetify module configuration
  ** https://github.com/nuxt-community/vuetify-module
  */
  router: {
    mode: 'hash',
    // base: '/xc/',
    middleware: ['auth']
  },
  vuetify: {
    defaultAssets: {
      // font: false,
      icons: false
    },
    optionsPath: '@/config/vuetify.options.js',
    treeShake: true,
    customVariables: ['./config/variables.scss']
  },
  /*
  ** Build configuration
  ** See https://nuxtjs.org/api/configuration-build/
  */
  build: {
    parallel: true,
    plugins: [
      new MonacoEditorWebpackPlugin({
        // https://github.com/Microsoft/monaco-editor-webpack-plugin#options
        // Include a subset of languages support
        // Some language extensions like typescript are so huge that may impact build performance
        // e.g. Build full languages support with webpack 4.0 takes over 80 seconds
        // Languages are loaded on demand at runtime
        languages: ['sql', 'json', 'javascript'],
        features: ['!gotoSymbol']
      })
    ],
    // publicPath: process.env.NODE_ENV === 'production' ? `https://cdn.jsdelivr.net/npm/nc-lib-gui@${version}/lib/dist/` : undefined,
    publicPath: process.env.NODE_ENV === 'production' ? './_nuxt/' : undefined,
    extend(config, {
      isDev,
      isClient
    }) {
      if (isDev) {
        config.devtool = isClient ? 'source-map' : 'inline-source-map'
      }

      config.externals = config.externals || {}
      config.externals['@microsoft/typescript-etw'] = 'FakeModule'

      // config.plugins.push(new MonacoEditorWebpackPlugin({
      //   languages: ['javascript', 'typescript', 'json', 'mysql', 'sql', 'pgsql'],
      //   features: ['!gotoSymbol', '!goToCommands']
      // }))

      if (!isDev) {
        // const WebpackObfuscator = require('webpack-obfuscator');
        // config.plugins.push(new WebpackObfuscator({
        //   compact: true,
        //   controlFlowFlattening: false,
        //   deadCodeInjection: false,
        //   debugProtection: false,
        //   debugProtectionInterval: false,
        //   disableConsoleOutput: true,
        //   identifierNamesGenerator: 'hexadecimal',
        //   log: false,
        //   numbersToExpressions: false,
        //   renameGlobals: false,
        //   rotateStringArray: true,
        //   selfDefending: true,
        //   shuffleStringArray: true,
        //   simplify: true,
        //   splitStrings: false,
        //   stringArray: true,
        //   stringArrayEncoding: false,
        //   stringArrayThreshold: 0.75,
        //   unicodeEscapeSequence: false
        // }))

        // relative links, please.
        // config.output.publicPath = "http://35.244.225.21/_nuxt/";
        // config.output.publicPath = "./_nuxt/";
        // NOTE: future release version of xc-lib-gui

        // const fs = require('fs');
        // const packageJson = JSON.parse(fs.readFileSync('../xc-lib-gui/package.json', 'utf8'));
        // const version = packageJson.version.replace(/\.(\d+)$/, (_, v) => {
        //   // if (v === '99') throw new Error('Package version reached 99')
        //   return `.${++v}`
        // });
        if (process.env.targetEnv === 'DEV') {
          // nightly build
          // e.g. 0.84.2-20220220-1250
          packageJson.version = `${packageJson.version}-${process.env.targetVersion}`
          packageJson.name += '-daily'
        } else {
          packageJson.version = version
        }
        fs.writeFileSync('../nc-lib-gui/package.json', JSON.stringify(packageJson, 0, 2))

        // config.output.publicPath = `https://cdn.jsdelivr.net/npm/nc-lib-gui@${version}/lib/dist/`;
        // const htmlWebpack = config.plugins.find(w => w instanceof HtmlWebpackPlugin);
        // htmlWebpack.options.publicPath = `https://cdn.jsdelivr.net/npm/xc-lib-gui@${version}/lib/dist/_nuxt/`;
        // const templateParams = htmlWebpack.templateParameters
        // htmlWebpack.templateParameters = (...args) =>{
        //   const res = templateParams(...args);
        //   return res;
        // };
      }
      if (!isDev) {
        config.output.publicPath = './_nuxt/'
      }

      return config
    }
  },
  loading: {
    color: '#13f4ef',
    height: '0px',
    continuous: true,
    duration: 3000
  },
  css: [
    // '@/assets/style/fonts.css',
    '@/assets/css/global.css',
    // "~/assets/style/app.styl",
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/style/style.css',
    '~/assets/style.css',
    'material-design-icons-iconfont/dist/material-design-icons.css'
  ],
  env: {
    EE: !!process.env.EE,
    NC_API_URL: 'https://nocodb.com'
  },
  pwa: {
    workbox: {
      /* workbox options */
      assetsURLPattern: './_nuxt/',
      pagesURLPattern: './'
    },
    manifest: {
      publicPath: './'
    }
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

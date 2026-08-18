/// <reference types="vitest" />

import fs from 'fs'
import path from 'path'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'
import { defaultExclude } from 'vitest/config'
import Vue from '@vitejs/plugin-vue'

// `packages/nc-gui/ee` is excluded from the OSS sync, but the tests covering it
// still come across. Without this they die at import resolution instead of on an
// assertion, so skip them whenever the EE sources are absent.
const hasEeSources = fs.existsSync(path.resolve(__dirname, '../ee'))

const eeOnlyTests = hasEeSources
  ? []
  : fs
      .readdirSync(__dirname)
      .filter((file) => file.endsWith('.test.ts'))
      .filter((file) => /['"](?:~|@|\.\.?)\/ee\//.test(fs.readFileSync(path.join(__dirname, file), 'utf-8')))
      .map((file) => `**/${file}`)

if (eeOnlyTests.length) {
  // Surface what was skipped — a silent exclude reads as full coverage.
  console.info(`[vitest] skipping ${eeOnlyTests.length} EE-only test file(s): ${eeOnlyTests.join(', ')}`)
}

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
  esbuild: {
    tsconfigRaw: '{}',
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [path.resolve(__dirname, './setup.ts')],
    exclude: [...defaultExclude, ...eeOnlyTests],
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

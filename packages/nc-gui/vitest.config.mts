import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~assets': fileURLToPath(new URL('./assets', import.meta.url)),
      'assets': fileURLToPath(new URL('./assets', import.meta.url)),
    },
  },
})

import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      'assets': fileURLToPath(new URL('./assets', import.meta.url)),
      'nocodb-sdk': fileURLToPath(new URL('../nocodb-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
})

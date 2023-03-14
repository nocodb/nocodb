import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: process.cwd(),
    globals: true,
    environment: 'happy-dom',
    reporters: 'dot',
  },
})

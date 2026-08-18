import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Mirrors the `~` / `@` alias Nuxt exposes to the app (srcDir === project root,
// see `.nuxt/tsconfig.json`), so composables/utils importable under `test/` can be
// loaded directly by vitest without pulling in the full Nuxt build pipeline.
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})

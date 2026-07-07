import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base: the built app is served under a deep, opaque preview path
  // (/api/internal/app-preview/<token>/…), so all asset URLs must be relative
  // to index.html rather than rooted at "/".
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@nocodb/app-ctx': fileURLToPath(
        new URL('./src/lib/app-ctx.ts', import.meta.url),
      ),
    },
  },
  build: {
    outDir: 'dist',
  },
});

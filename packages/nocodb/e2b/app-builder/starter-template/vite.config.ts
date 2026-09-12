import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base: the built app is served under different path prefixes — its
  // own domain root when published, a deep preview path in the builder — so
  // asset URLs stay relative and a `<base href>` injected at serve time points
  // them at the right prefix (history routes would otherwise break `./assets`
  // resolution at depth). See window.__nc_app_base__ / the App.tsx basename.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
  },
});

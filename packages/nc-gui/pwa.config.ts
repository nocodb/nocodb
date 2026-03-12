import type { ModuleOptions } from '@vite-pwa/nuxt'

export const pwaConfig: ModuleOptions = {
  registerType: 'autoUpdate',
  manifest: {
    name: 'NocoDB',
    short_name: 'NocoDB',
    description: 'NocoDB - The Open Source Airtable Alternative',
    theme_color: '#3366FF',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    icons: [
      {
        src: 'pwa-64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512-dark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    navigateFallback: '/',
    // Precache only small static assets — JS is handled via runtimeCaching below
    globPatterns: ['**/*.{css,html,png,svg,ico,woff2}'],
    runtimeCaching: [
      {
        // Cache JS chunks on first use (StaleWhileRevalidate for speed + freshness)
        urlPattern: /\/_nuxt\/.*\.js$/,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'js-chunks',
          expiration: {
            maxEntries: 150,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
  client: {
    installPrompt: true,
  },
  devOptions: {
    enabled: true,
    type: 'module',
    suppressWarnings: true,
  },
}

/**
 * The service worker must not cache anything, in any environment.
 *
 * The caching worker forced a reload of every open tab on the first load after each
 * deployment (autoUpdate + precached shell), served stale builds in dev (shell and
 * /_nuxt/*.js kept stale-while-revalidate), and its navigateFallback swallowed backend
 * routes twice. NocoDB cannot work offline and installability only needs the manifest.
 *
 * `selfDestroying` ships a worker that unregisters whatever worker a browser already has
 * and clears its caches. It has to stay: if /sw.js ever fell through to the SPA shell, a
 * straggler's old worker would fail its update check and keep serving a stale shell.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

const loadConfig = async (nodeEnv: string) => {
  vi.stubEnv('NODE_ENV', nodeEnv)
  vi.resetModules()
  return (await import('../pwa.config')).pwaConfig
}

describe('pwa service worker', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each(['production', 'development'])('ships a self-destroying worker in %s', async (nodeEnv) => {
    expect((await loadConfig(nodeEnv)).selfDestroying).toBe(true)
  })

  it('configures no caching and no navigation fallback', async () => {
    expect((await loadConfig('production')).workbox).toBeUndefined()
  })

  it('keeps the manifest so the app stays installable', async () => {
    const { manifest } = await loadConfig('production')

    expect(manifest?.display).toBe('standalone')
    expect(manifest?.icons?.length).toBeGreaterThan(0)
  })
})

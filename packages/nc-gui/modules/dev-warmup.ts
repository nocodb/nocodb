import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { addVitePlugin, defineNuxtModule, useLogger } from '@nuxt/kit'
import type { Plugin, ViteDevServer } from 'vite'

/**
 * Dev only. Vite compiles modules on first request and keeps nothing across restarts, so the
 * first page load after every start redoes ~20s of single-threaded compile work. This records
 * the module URLs the browser requests and replays them on the next start, so that work runs
 * while the backend is still booting. `NC_DEV_WARMUP=false` turns it off.
 */

const MAX_ENTRIES = 8000

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

const CONCURRENCY = 8

// Codes that mean "not now", not "this URL is gone" — never prune on them.
const TRANSIENT_ERRORS = new Set(['ERR_CLOSED_SERVER', 'ERR_OUTDATED_OPTIMIZED_DEP'])

type Logger = ReturnType<typeof useLogger>

// Prebundled deps are served from the optimizer cache and need no compile. `?v=` marks a raw
// node_modules file: the hash changes every start, and its importer pre-compiles it anyway.
function isWarmable(url: string) {
  return !url.startsWith('/@vite/') && !url.includes('/.cache/vite/') && !url.endsWith('.map') && !/[?&]v=/.test(url)
}

function loadEntries(file: string): Map<string, number> {
  try {
    const cutoff = Date.now() - MAX_AGE_MS
    const entries = JSON.parse(readFileSync(file, 'utf8')) as [string, number][]

    return new Map(entries.filter(([url, seenAt]) => seenAt > cutoff && isWarmable(url)))
  } catch {
    return new Map()
  }
}

function saveEntries(file: string, entries: Map<string, number>) {
  try {
    const newest = [...entries].sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES)
    const kept = new Set(newest.map(([url]) => url))

    mkdirSync(dirname(file), { recursive: true })
    // Insertion order is request order, which keeps importers ahead of their imports.
    writeFileSync(file, JSON.stringify([...entries].filter(([url]) => kept.has(url))))
  } catch {}
}

// Mirrors Vite's transform middleware, so a replayed URL lands on the module the browser asked for.
function normaliseUrl(rawUrl: string, base: string): string | null {
  let url = base !== '/' && rawUrl.startsWith(base) ? rawUrl.slice(base.length - 1) : rawUrl

  try {
    url = decodeURI(url)
  } catch {
    return null
  }

  url = url
    .replace(/\bt=\d{13}&?\b/, '')
    .replace(/(\?|&)import=?(?:&|$)/, '$1')
    .replace(/[?&]$/, '')

  if (url.startsWith('/@id/')) url = url.slice('/@id/'.length).replace('__x00__', '\0')

  return isWarmable(url) ? url : null
}

async function waitForOptimizer(server: ViteDevServer) {
  const optimizer = server.environments.client.depsOptimizer
  if (!optimizer) return

  for (let i = 0; i < 300 && !optimizer.metadata; i++) await new Promise((resolve) => setTimeout(resolve, 100))

  await optimizer.scanProcessing
}

async function replay(server: ViteDevServer, entries: Map<string, number>, browserBusy: () => boolean, logger: Logger) {
  const urls = [...entries.keys()]
  if (!urls.length) return

  await waitForOptimizer(server)

  const environment = server.environments.client
  const startedAt = Date.now()
  let next = 0
  let warmed = 0
  // Set once Nuxt restarts the dev server; the new server runs its own replay.
  let closed = false

  async function worker() {
    while (!closed && next < urls.length) {
      // The compile thread is shared: let a page that is loading right now go first.
      if (browserBusy()) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        continue
      }

      const url = urls[next++]!

      try {
        if (await environment.transformRequest(url)) warmed++
        else entries.delete(url)
      } catch (e) {
        const code = (e as { code?: string })?.code
        if (code === 'ERR_CLOSED_SERVER') closed = true
        else if (!code || !TRANSIENT_ERRORS.has(code)) entries.delete(url)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  if (!closed) logger.info(`warmed ${warmed} modules in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

function devWarmupPlugin(cacheFile: string, logger: Logger): Plugin {
  return {
    name: 'nc:dev-warmup',
    apply: 'serve',
    configureServer(server) {
      if (process.env.NC_DEV_WARMUP === 'false') return

      const entries = loadEntries(cacheFile)
      let saveTimer: ReturnType<typeof setTimeout> | undefined
      let inFlight = 0
      let lastBrowserActivity = 0

      server.middlewares.use((req, res, next) => {
        // Module imports, including CSS and assets pulled in through JS, are all `script` fetches.
        if (req.method === 'GET' && req.url && req.headers['sec-fetch-dest'] === 'script') {
          const url = normaliseUrl(req.url, server.config.base)

          inFlight++
          lastBrowserActivity = Date.now()
          res.once('close', () => {
            inFlight--
            lastBrowserActivity = Date.now()
          })

          if (url) {
            res.once('finish', () => {
              if (res.statusCode >= 400) return

              entries.set(url, Date.now())
              clearTimeout(saveTimer)
              saveTimer = setTimeout(() => saveEntries(cacheFile, entries), 5000)
            })
          }
        }

        next()
      })

      setTimeout(() => {
        // A loading page leaves short gaps between import waves; replaying into them slows it down.
        // The head start covers an open tab, which reloads the moment the server is back: once a
        // replayed module is in, Vite pre-compiles its whole static import graph regardless.
        const headStartUntil = Date.now() + 3000
        const browserBusy = () => inFlight > 0 || Date.now() - lastBrowserActivity < 1500 || Date.now() < headStartUntil

        replay(server, entries, browserBusy, logger)
          .then(() => saveEntries(cacheFile, entries))
          .catch(() => {})
      }, 0)
    },
  }
}

export default defineNuxtModule({
  meta: {
    name: 'nc-dev-warmup',
  },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return

    // Registered even when disabled: Vite hashes plugin names into its dep cache key, so
    // toggling the plugin itself would force a full dependency re-optimize.
    const logger = useLogger('nc-dev-warmup')
    const cacheFile = join(nuxt.options.rootDir, 'node_modules/.cache/nc-dev-warmup.json')

    addVitePlugin(devWarmupPlugin(cacheFile, logger), { server: false })
  },
})

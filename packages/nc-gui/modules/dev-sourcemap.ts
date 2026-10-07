import { addVitePlugin, defineNuxtModule, useLogger } from '@nuxt/kit'
import type { Plugin } from 'vite'

/**
 * Dev only, opt-in: `NC_DEV_SOURCEMAP=false` stops generating and merging sourcemaps, which is
 * about a third of the compile cost of a `.vue` module. Devtools then show compiled code.
 * Vite's own `dev.sourcemap` option is declared but not implemented, hence the wrapping.
 */

// Vite stops merging a module's maps at the first `{ mappings: '' }` and serves it without one.
const EMPTY_MAP = { mappings: '' }

interface TransformResult {
  code?: string
  map?: unknown
  moduleType?: string
  meta?: unknown
  moduleSideEffects?: unknown
}

type TransformHandler = (this: unknown, ...args: unknown[]) => unknown

function dropMap(result: unknown) {
  if (!result || typeof result !== 'object') return result

  // Read fields one by one: some results compute `map` in a lazy getter, never trigger it.
  const { code, moduleType, meta, moduleSideEffects } = result as TransformResult
  if (code === undefined) return result

  return { code, map: EMPTY_MAP, moduleType, meta, moduleSideEffects }
}

function wrapTransform(plugin: Plugin) {
  const hook = plugin.transform as unknown
  if (!hook) return

  const handler = (typeof hook === 'function' ? hook : (hook as { handler: TransformHandler }).handler) as TransformHandler
  const wrapped = async function (this: unknown, ...args: unknown[]) {
    return dropMap(await handler.apply(this, args))
  }

  // Object hooks keep their `filter` and `order`; Vite reads them alongside the handler.
  plugin.transform = (typeof hook === 'function' ? wrapped : { ...(hook as object), handler: wrapped }) as Plugin['transform']
}

function devSourcemapPlugin(logger: ReturnType<typeof useLogger>): Plugin {
  return {
    name: 'nc:dev-sourcemap',
    apply: 'serve',
    // After every plugin's configResolved, so plugin-vue has set its own options.
    configureServer(server) {
      if (process.env.NC_DEV_SOURCEMAP !== 'false') return

      // The client environment resolves its own list; it usually shares the top-level objects.
      const plugins = new Set([...server.config.plugins, ...server.environments.client.config.plugins] as Plugin[])

      for (const plugin of plugins) {
        if (plugin.name === 'vite:vue') {
          const api = plugin.api as { options: Record<string, unknown> }
          api.options = { ...api.options, sourceMap: false }
        }

        wrapTransform(plugin)
      }

      logger.info('sourcemaps off (NC_DEV_SOURCEMAP=false): devtools show compiled code')
    },
  }
}

export default defineNuxtModule({
  meta: {
    name: 'nc-dev-sourcemap',
  },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return

    // Nuxt's own transforms skip generating maps when this is off.
    if (process.env.NC_DEV_SOURCEMAP === 'false') nuxt.options.sourcemap = { server: false, client: false }

    // Registered even when off: Vite hashes plugin names into its dep cache key.
    addVitePlugin(devSourcemapPlugin(useLogger('nc-dev-sourcemap')), { server: false })
  },
})

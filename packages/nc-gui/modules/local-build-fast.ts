import { defineNuxtModule, useLogger } from '@nuxt/kit'
import type { Plugin } from 'vite'

/**
 * Local production builds only, opt-in: `NC_DEV_FAST=true pnpm build:ee` skips Nuxt's import
 * protection, whose hooks run on every module from the single JS thread. Dev servers and
 * builds without the flag (CI, releases) keep it.
 */

const HOOKS = ['resolveId', 'load', 'transform'] as const

// Removing entries from the resolved plugin list crashes Nuxt; emptying their hooks doesn't.
function disable(plugin: Plugin) {
  for (const hook of HOOKS) delete plugin[hook]
}

export default defineNuxtModule({
  meta: {
    name: 'nc-local-build-fast',
  },
  setup(_options, nuxt) {
    if (nuxt.options.dev || process.env.NC_DEV_FAST !== 'true') return

    const logger = useLogger('nc-local-build-fast')

    nuxt.hook('vite:configResolved', (config) => {
      // The resolved list can hold empty slots.
      const disabled = config.plugins.filter((plugin) => plugin && /impound/.test(plugin.name))
      disabled.forEach(disable)
      logger.info(`import protection off (NC_DEV_FAST=true): ${disabled.map((p) => p.name).join(', ')}`)
    })
  },
})

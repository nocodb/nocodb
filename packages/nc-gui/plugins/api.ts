import type { Api } from 'nocodb-sdk'
import { installInternalApiBatch } from '../composables/useInternalBatch'

const apiPlugin = (nuxtApp) => {
  const { api } = useApi()

  // Coalesce `$api.internal.*` calls fired in the same ~50ms window into
  // a single `batch` envelope. Transparent to every existing call site;
  // see installInternalApiBatch for opt-outs (axios-config caller bypasses
  // the queue).
  installInternalApiBatch(api)

  /** injects a global api instance */
  nuxtApp.provide('api', api)
}

declare module _NuxtApp {
  interface NuxtApp {
    $api: Api<any>
  }
}

export { apiPlugin }

export default defineNuxtPlugin(function (nuxtApp) {
  if (!isEeUI) return apiPlugin(nuxtApp)
})

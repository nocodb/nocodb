import type { Api } from 'nocodb-sdk'

function apiPlugin(nuxtApp) {
  const { api } = useApi()

  /** injects a global api instance */
  nuxtApp.provide('api', api)
}

declare namespace _NuxtApp {
  interface NuxtApp {
    $api: Api<any>
  }
}

export { apiPlugin }

export default defineNuxtPlugin((nuxtApp) => {
  if (!isEeUI) return apiPlugin(nuxtApp)
})

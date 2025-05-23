import type { Api } from 'nocodb-sdk'

const apiPlugin = (nuxtApp) => {
  const { api } = useApi()

  /** injects a global api instance */
  nuxtApp.provide('api', api)
}

declare module '#app' {
  interface NuxtApp {
    $api: Api<any>
  }
}

export { apiPlugin }

export default defineNuxtPlugin(function (nuxtApp) {
  if (!isEeUI) return apiPlugin(nuxtApp)
})

const apiPlugin = (nuxtApp) => {
  /** injects a global api instance */
  nuxtApp.provide('api', useApi().api)
}

declare module '#app' {
  interface NuxtApp {
    $api: ReturnType<typeof createApiInstance>
  }
}

export { apiPlugin }

export default defineNuxtPlugin(function (nuxtApp) {
  if (!isEeUI) return apiPlugin(nuxtApp)
})

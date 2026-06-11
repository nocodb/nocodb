// ref - https://github.com/nuxt/nuxt/issues/26565
export default defineNuxtPlugin((nuxtApp) => {
  const MAX_RETRIES = 2
  const QUERY_PARAM_NAME = 'reload_attempt'

  const reload = () => {
    const url = new URL(window.location.href)
    const currentRetry = Number(url.searchParams.get(QUERY_PARAM_NAME)) || 0

    if (currentRetry < MAX_RETRIES) {
      console.log('[nuxt]: Reloading due to chunk error')
      url.searchParams.set(QUERY_PARAM_NAME, (currentRetry + 1).toString())

      window.location.replace(url.toString())
    }
  }

  // Handle "Failed to fetch dynamically imported module ..." or similar issues
  nuxtApp.hook('app:chunkError', () => {
    reload()
  })

  nuxtApp.hook('app:error', (error) => {
    const reload_error_list = [
      'error loading dynamically imported module',
      'Importing a module script failed',
      'Failed to fetch dynamically imported module',
    ]
    for (const message of reload_error_list) {
      if (ncIsString(error?.message) && error.message.includes(message)) {
        reload()
      }
    }
  })
})

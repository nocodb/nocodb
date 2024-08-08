// ref - https://github.com/nuxt/nuxt/issues/26565
export default defineNuxtPlugin((nuxtApp) => {
  const MAX_RETRIES = 2
  const QUERY_PARAM_NAME = 'reload_attempt'

  const reload = () => {
    const searchParams = new URLSearchParams(window.location.search)
    const currentRetry = Number(searchParams.get(QUERY_PARAM_NAME)) || 0
    if (currentRetry < MAX_RETRIES) {
      console.log('[nuxt]: Reloading due to chunk error')
      searchParams.set(QUERY_PARAM_NAME, (currentRetry + 1).toString())
      // Changing the search also causes a refresh
      window.location.search = searchParams.toString()
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
      if (error.message.includes(message)) {
        reload()
      }
    }
  })
})

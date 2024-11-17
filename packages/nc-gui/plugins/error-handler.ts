// ref - https://github.com/nuxt/nuxt/issues/26565
export default defineNuxtPlugin((nuxtApp) => {
  const MAX_RETRIES = 2
  const QUERY_PARAM_NAME = 'reload_attempt'

  const reload = () => {
    const url = new URL(window.location.href)
    const hash = url.hash || '' // Get the current hash part

    // Extract path and query from the hash
    const [path, queryString] = hash.split('?')
    const searchParams = new URLSearchParams(queryString || '')
    const currentRetry = Number(searchParams.get(QUERY_PARAM_NAME)) || 0

    if (currentRetry < MAX_RETRIES) {
      console.log('[nuxt]: Reloading due to chunk error')
      searchParams.set(QUERY_PARAM_NAME, (currentRetry + 1).toString())

      // Rebuild the hash with updated query params
      const newHash = `${path}?${searchParams.toString()}`
      url.hash = newHash

      window.location.replace(url.toString())
      // sometimes replace will not causes a refresh so we have to reload page
      window.location.reload()
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

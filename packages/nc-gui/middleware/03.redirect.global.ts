export default defineNuxtRouteMiddleware(async () => {
  // Get the query params from the URL
  const params = new URLSearchParams(window.location.search)

  // Get 'hash-redirect' and 'hash-query-params' from the query params
  const redirect = params.get('hash-redirect')
  const encodedQueryParams = params.get('hash-query-params')

  // If redirect query param is set, combine it with hash-query-params
  if (redirect) {
    // Start with the redirect path
    let url = `/#${redirect}`

    // If hash-query-params exists, decode and append it
    if (encodedQueryParams) {
      // Decode and parse the query params
      const decodedParams = new URLSearchParams(decodeURIComponent(encodedQueryParams))

      // Append the decoded query params to the URL
      const queryString = decodedParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    // Redirect to the combined URL
    window.location.href = url
  }
})

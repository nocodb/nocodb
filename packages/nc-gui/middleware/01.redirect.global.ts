import { baseSettingsTabToSlug } from '~/utils/settingsRouteUtils'

export default defineNuxtRouteMiddleware(async (to) => {
  // Get the query params from the URL
  const params = new URLSearchParams(window.location.search)

  // Get 'hash-redirect' and 'hash-query-params' from the query params
  // (backward compat: custom URL controller used to pass these)
  const redirect = params.get('hash-redirect')
  const encodedQueryParams = params.get('hash-query-params')

  // If redirect query param is set, navigate to the clean path
  if (redirect) {
    let url = redirect

    // If hash-query-params exists, decode and append it
    if (encodedQueryParams) {
      const decodedParams = new URLSearchParams(decodeURIComponent(encodedQueryParams))
      const queryString = decodedParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    return navigateTo(url, { replace: true })
  }

  // Redirect old ?page= query param routes to new /settings/{slug} paths
  const page = to.query.page as string | undefined

  if (page && to.params.baseId) {
    // Special case: ?page=base-settings&tab=mcp → /settings/mcp
    if (page === 'base-settings' && to.query.tab === 'mcp') {
      return navigateTo(`/${to.params.typeOrId}/${to.params.baseId}/settings/mcp`, { replace: true })
    }

    const slug = baseSettingsTabToSlug[page]

    if (slug) {
      // Forward remaining query params (excluding page and tab)
      const { page: _, tab: __, ...rest } = to.query
      const query = Object.keys(rest).length ? rest : undefined

      return navigateTo({ path: `/${to.params.typeOrId}/${to.params.baseId}/settings/${slug}`, query }, { replace: true })
    }
  }
})

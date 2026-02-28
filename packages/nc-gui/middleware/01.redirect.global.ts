// Map old ?page= tab names to new /admin/{slug} paths
const pageToSlug: Record<string, string> = {
  collaborator: 'members',
  'data-source': 'data-sources',
  permissions: 'permissions',
  syncs: 'syncs',
  'base-settings': 'settings',
  audits: 'audits',
  workflows: 'workflows',
  overview: 'overview',
  mcp: 'mcp',
  snapshots: 'snapshots',
}

export default defineNuxtRouteMiddleware(async (to) => {
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
    return
  }

  // Redirect old ?page= query param routes to new /admin/{slug} paths
  const page = to.query.page as string | undefined

  if (page && to.params.baseId) {
    // Special case: ?page=base-settings&tab=mcp → /admin/mcp
    if (page === 'base-settings' && to.query.tab === 'mcp') {
      return navigateTo(`/${to.params.typeOrId}/${to.params.baseId}/admin/mcp`, { replace: true })
    }

    const slug = pageToSlug[page]

    if (slug) {
      // Forward remaining query params (excluding page and tab)
      const { page: _, tab: __, ...rest } = to.query
      const query = Object.keys(rest).length ? rest : undefined

      return navigateTo({ path: `/${to.params.typeOrId}/${to.params.baseId}/admin/${slug}`, query }, { replace: true })
    }
  }

})

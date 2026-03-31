import { type RouteLocationNormalizedLoadedGeneric } from 'vue-router'

/**
 * Check if the route is a shared view route
 * @param route - The route to check
 * @returns true if the route is a shared view route, false otherwise
 */
export const isSharedViewRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return route.meta.pageType === 'shared-view'
}

/**
 * Check if the route is a shared form view route
 * @param route - The route to check
 * @returns true if the route is a shared form view route, false otherwise
 */
export const isSharedFormViewRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  const routeName = (route.name as string) || ''

  // check route is shared form view route
  return routeName.startsWith('index-typeOrId-form-viewId')
}

/**
 * Check if the route is a public route
 * @param route - The route to check
 * @returns true if the route is a public route, false otherwise
 */
export const isPublicRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return route.meta?.public
}

export const isSharedBaseOrErdOrViewRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return (
    isSharedViewRoute(route) ||
    isSharedFormViewRoute(route) ||
    route.params.typeOrId === 'base' ||
    route.params.typeOrId === 'ERD'
  )
}

export const wsHomeRouteNames = new Set([
  'index',
  'index-index',
  'index-typeOrId',
  'index-typeOrId-index',
  'index-typeOrId-members',
  'index-typeOrId-teams',
  'index-typeOrId-billing',
  'index-typeOrId-audits',
  'index-typeOrId-sso',
  'index-typeOrId-settings',
  'index-typeOrId-integrations',
])

export const isWsHomeRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return wsHomeRouteNames.has(route.name as string)
}

/**
 * Maps route names to workspace tab keys.
 *
 * Both `'index-typeOrId-index'` and `'index-typeOrId'` resolve to `'bases'`.
 * When inverted, `'index-typeOrId'` wins (last entry) — so `wsTabToRouteName['bases']`
 * navigates to `'index-typeOrId'`, which is the intended parent route for the bases tab.
 */
export const routeNameToWsTab: Record<string, string> = {
  'index-typeOrId-index': 'bases',
  'index-typeOrId': 'bases',
  'index-typeOrId-members': 'collaborators',
  'index-typeOrId-teams': 'teams',
  'index-typeOrId-integrations': 'integrations',
  'index-typeOrId-audits': 'audits',
  'index-typeOrId-billing': 'billing',
  'index-typeOrId-sso': 'sso',
  'index-typeOrId-settings': 'settings',
}

/**
 * Inverse of `routeNameToWsTab` — maps tab keys back to route names.
 */
export const wsTabToRouteName: Record<string, string> = Object.fromEntries(
  Object.entries(routeNameToWsTab).map(([k, v]) => [v, k]),
)

/**
 * Route names that correspond to workspace settings pages.
 * Used to detect whether the current route is a workspace settings page.
 */
export const wsSettingsRouteNames = new Set([
  'index-typeOrId-settings-page',
  'index-typeOrId-members',
  'index-typeOrId-teams',
  'index-typeOrId-billing',
  'index-typeOrId-audits',
  'index-typeOrId-sso',
  'index-typeOrId-ws-settings',
  'index-typeOrId-general',
  'index-typeOrId-more',
])

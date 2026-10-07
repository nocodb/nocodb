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

/** Public share-to-web dashboard route (`/:typeOrId/dashboard/:uuid`) */
export const isSharedDashboardRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return ((route.name as string) || '').startsWith('index-typeOrId-dashboard-dashboardId')
}

/** Public share-to-web interface route (`/:typeOrId/interface/:uuid`) */
export const isSharedInterfaceRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  return ((route.name as string) || '').startsWith('index-typeOrId-interface-uuid')
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
  'index-typeOrId-home',
  'index-typeOrId-index',
  'index-typeOrId-members',
  'index-typeOrId-teams',
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
  'index-typeOrId-home': 'home',
  'index-typeOrId-index': 'bases',
  'index-typeOrId': 'bases',
  'index-typeOrId-members': 'collaborators',
  'index-typeOrId-teams': 'teams',
  'index-typeOrId-integrations': 'integrations',
}

/**
 * Inverse of `routeNameToWsTab` — maps tab keys back to route names.
 */
export const wsTabToRouteName: Record<string, string> = Object.fromEntries(
  Object.entries(routeNameToWsTab).map(([k, v]) => [v, k]),
)

/** Workspace panes that open in the home page's content area, at `/{ws}/{pane}`. */
export const wsHomePanes = ['members', 'teams', 'integrations'] as const

export type WsHomePane = (typeof wsHomePanes)[number]

export function isWsHomePane(value: unknown): value is WsHomePane {
  return typeof value === 'string' && (wsHomePanes as readonly string[]).includes(value)
}

export function wsHomePanePath(workspaceId: string, pane: WsHomePane) {
  return `/${workspaceId}/${pane}`
}

/** The home pane the current route shows, else null. */
export function wsHomePaneFromRoute(route?: { name?: unknown }): WsHomePane | null {
  const pane = typeof route?.name === 'string' ? route.name.replace(/^index-typeOrId-/, '') : ''

  return isWsHomePane(pane) ? pane : null
}

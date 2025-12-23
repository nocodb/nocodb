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

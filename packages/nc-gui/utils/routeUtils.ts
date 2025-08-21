import { type RouteLocationNormalizedLoadedGeneric } from 'vue-router'

/**
 * Check if the route is a shared view route
 * @param route - The route to check
 * @returns true if the route is a shared view route, false otherwise
 */
export const isSharedViewRoute = (route: RouteLocationNormalizedLoadedGeneric) => {
  if (!route) return false

  const routeName = (route.name as string) || ''

  // check route is not base page by route name
  return (
    !routeName.startsWith('index-typeOrId-baseId-') &&
    !['index', 'index-typeOrId', 'index-typeOrId-feed', 'index-typeOrId-integrations'].includes(routeName)
  )
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

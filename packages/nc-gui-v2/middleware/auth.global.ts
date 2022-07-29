import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'

/**
 * Global auth middleware
 *
 * On page transitions, this middleware checks if the target route requires authentication.
 * If the user is not signed in, the user is redirected to the sign in page.
 * If the user is signed in and attempts to access a route that does not require authentication (i.e. signin/signup pages),
 * the user is redirected to the home page.
 *
 * By default, we assume that auth is required
 * If not required, mark the page as `requiresAuth: false` using `definePageMeta`
 *
 * @example
 * ```
 * definePageMeta({
 *  requiresAuth: false,
 *  ...
 *  })
 * ```
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const { $state } = useNuxtApp()

  /** if auth is required or unspecified (same as required) and user is not signed in, redirect to signin page */
  if ((to.meta.requiresAuth || typeof to.meta.requiresAuth === 'undefined') && !$state.signedIn.value) {
    return navigateTo('/signin')
  } else if (to.meta.requiresAuth === false && $state.signedIn.value) {
    /**
     * if user was turned away from non-auth page but also came from a non-auth page (e.g. user went to /signin and reloaded the page)
     * redirect to home page
     *
     * else redirect back to the page they were coming from
     */
    if (from.meta.requiresAuth === false) {
      return navigateTo('/')
    } else {
      return navigateTo(from.path)
    }
  }
})

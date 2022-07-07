import { defineNuxtRouteMiddleware, navigateTo, useNuxtApp } from '#app'

export default defineNuxtRouteMiddleware((to, from) => {
  const { $state } = useNuxtApp()

  /**
   * By default, we assume that auth is required
   * If not required, mark the page as `requiresAuth: false` using `definePageMeta`
   */
  if ((to.meta.requiresAuth || typeof to.meta.requiresAuth === 'undefined') && !$state.signedIn.value) {
    return navigateTo('/signin')
  } else if (to.meta.requiresAuth === false && $state.signedIn.value) {
    return navigateTo(from.path)
  }
})

import { defineNuxtPlugin } from '#app'
import { useGlobalState } from '~/composables/useGlobalState'

/**
 * Injects global state into nuxt app.
 *
 * @example
 * ```js
 * import { useNuxtApp } from '#app'
 *
 * const { $state } = useNuxtApp()
 *
 * console.log($state.lang.value) // 'en'
 * ```
 */
export default defineNuxtPlugin((nuxtApp) => {
  const storage = useGlobalState()

  /** set i18n locale to stored language */
  nuxtApp.vueApp.i18n.locale = storage.lang.value

  nuxtApp.provide('state', storage)
})

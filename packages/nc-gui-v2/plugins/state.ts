import { breakpointsTailwind } from '@vueuse/core'
import { defineNuxtPlugin } from '#app'
import { useBreakpoints, useDark, useGlobal, watch } from '#imports'

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
  const state = useGlobal()

  const darkMode = useDark()

  /** get current breakpoints (for enabling sidebar) */
  const breakpoints = useBreakpoints(breakpointsTailwind)

  /** set i18n locale to stored language */
  nuxtApp.vueApp.i18n.locale.value = state.lang.value

  /** set current dark mode from storage */
  watch(
    state.darkMode,
    (newMode) => {
      darkMode.value = newMode
    },
    { immediate: true },
  )

  /** is initial sidebar open */
  state.sidebarOpen.value = state.signedIn.value && breakpoints.greater('md').value
})

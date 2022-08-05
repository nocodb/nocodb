import { breakpointsTailwind } from '@vueuse/core'
import { defineNuxtPlugin } from '#app'
import { useBreakpoints, useDark, useGlobal, useSidebar, watch } from '#imports'

/**
 * Initialize global state and watches for changes
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
})

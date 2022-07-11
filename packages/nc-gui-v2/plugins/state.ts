import { defineNuxtPlugin } from '#app'
import { useDark, watch } from '#imports'
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
  const darkMode = useDark()

  /** set i18n locale to stored language */
  nuxtApp.vueApp.i18n.locale.value = storage.lang.value

  /** set current dark mode from storage */
  watch(
    storage.darkMode,
    (newMode) => {
      darkMode.value = newMode
    },
    { immediate: true },
  )

  nuxtApp.provide('state', storage)
})

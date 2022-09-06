import { defineNuxtPlugin, useApi, useGlobal } from '#imports'

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
export default defineNuxtPlugin(async (nuxtApp) => {
  const state = useGlobal()

  const { api } = useApi()

  /** set i18n locale to stored language */
  nuxtApp.vueApp.i18n.locale.value = state.lang.value

  try {
    state.appInfo.value = await api.utils.appInfo()
  } catch (e) {
    console.error(e)
  }
})

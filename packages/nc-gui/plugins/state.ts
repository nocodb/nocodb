import { defineNuxtPlugin, useApi, useGlobal } from '#imports'
import { loadLocaleMessages, setI18nLanguage } from '~/plugins/a.i18n'

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

  const i18n = nuxtApp.vueApp.i18n

  const currentLang = state.lang.value

  await loadLocaleMessages(i18n, currentLang)

  /** set i18n locale to stored language */
  setI18nLanguage(i18n, state.lang.value)

  try {
    state.appInfo.value = await api.utils.appInfo()
  } catch (e) {
    console.error(e)
  }
})

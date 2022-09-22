import { loadLocaleMessages, setI18nLanguage } from './a.i18n'
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
export default defineNuxtPlugin(async () => {
  const state = useGlobal()

  const { api } = useApi()

  const currentLang = state.lang.value

  /** force load initial locale messages */
  await loadLocaleMessages(currentLang)

  /** set i18n locale to stored language */
  await setI18nLanguage(currentLang)

  try {
    state.appInfo.value = await api.utils.appInfo()
  } catch (e) {
    console.error(e)
  }
})

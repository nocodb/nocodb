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
export default defineNuxtPlugin(async () => {
  const state = useGlobal()

  const { api } = useApi()

  const currentLang = state.lang.value

  /** force load initial locale messages */
  await loadLocaleMessages(currentLang)
  const route = useRoute()
  /** force turn off of dark mode, regardless of previously stored settings */
  state.darkMode.value = route.query.dark === '1' || false

  /** set i18n locale to stored language */
  await setI18nLanguage(currentLang)

  try {
    state.appInfo.value = await api.utils.appInfo()
  } catch (e) {
    console.error(e)
  }
})



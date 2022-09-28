import { defineNuxtPlugin, useApi, useGlobal } from '#imports'
import { loadLocaleMessages, setI18nLanguage } from '~/plugins/a.i18n'
import { Language, LanguageAlias } from '~/lib'

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

  const { api } = useApi({ useGlobalInstance: true })

  let currentLang = state.lang.value

  /** fall back to EN language if the current language cannot be found in Language or LanguagesAlias */
  if (![...Object.keys(Language), ...Object.keys(LanguageAlias)].includes(currentLang)) state.lang.value = currentLang = 'en'

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

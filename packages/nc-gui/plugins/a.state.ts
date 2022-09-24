import { loadLocaleMessages, setI18nLanguage } from './a.i18n'
import { defineNuxtPlugin, useApi, useGlobal, watch } from '#imports'
import { useUnstorage } from '~/composables/useUnstorage'
import type { StoredState } from '~/composables/useGlobal'
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
export default defineNuxtPlugin(async (nuxt) => {
  const state = useGlobal()

  nuxt.provide('state', state)

  const { api } = useApi({ useGlobalInstance: true })

  let currentLang = state.lang.value

  /** fall back to EN language if the current language cannot be found in Language or LanguagesAlias */
  if (![...Object.keys(Language), ...Object.keys(LanguageAlias)].includes(currentLang)) state.lang.value = currentLang = 'en'

  /** force load initial locale messages */
  await loadLocaleMessages(currentLang)

  /** set i18n locale to stored language */
  await setI18nLanguage(currentLang)

  const storedState = await useUnstorage.getItem('global:state')
  state.storage.value = { ...state.storage.value, ...(storedState as StoredState) }

  watch(
    state.storage,
    (nextState) => {
      useUnstorage.setItem('global:state', nextState)
    },
    { deep: true, flush: 'post' },
  )

  try {
    state.appInfo.value = await api.utils.appInfo()
  } catch (e) {
    console.error(e)
  }
})

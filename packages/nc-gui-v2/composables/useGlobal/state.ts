import { usePreferredLanguages, useStorage } from '@vueuse/core'
import { useJwt } from '@vueuse/integrations/useJwt'
import type { JwtPayload } from 'jwt-decode'
import type { State, StoredState } from './types'
import { computed, ref, toRefs, useNuxtApp, useTimestamp } from '#imports'
import type { User } from '~/lib'

const storageKey = 'nocodb-gui-v2'

export function useGlobalState(): State {
  /** get the preferred languages of a user, according to browser settings */
  const preferredLanguages = $(usePreferredLanguages())
  /** todo: reimplement; get the preferred dark mode setting, according to browser settings */
  //   const prefersDarkMode = $(usePreferredDark())
  const prefersDarkMode = false

  /** reactive timestamp to check token expiry against */
  const timestamp = useTimestamp({ immediate: true, interval: 100 })

  const {
    vueApp: { i18n },
  } = useNuxtApp()

  /**
   * Set initial language based on browser settings.
   * If the user has not set a preferred language, we fallback to 'en'.
   * If the user has set a preferred language, we try to find a matching locale in the available locales.
   */
  const preferredLanguage = preferredLanguages.reduce<string>((locale, language) => {
    /** split language to language and code, e.g. en-GB -> [en, GB] */
    const [lang, code] = language.split(/[_-]/)

    /** find all locales that match the language */
    let availableLocales = i18n.availableLocales.filter((locale) => locale.startsWith(lang))

    /** If we can match more than one locale, we check if the code of the language matches as well */
    if (availableLocales.length > 1) {
      availableLocales = availableLocales.filter((locale) => locale.endsWith(code))
    }

    /** if there are still multiple locales, pick the first one */
    const availableLocale = availableLocales[0]

    /** if we found a matching locale, return it */
    if (availableLocale) locale = availableLocale

    return locale
  }, 'en' /** fallback locale */)

  /** State */
  const initialState: StoredState = { token: null, user: null, lang: preferredLanguage, darkMode: prefersDarkMode }

  /** saves a reactive state, any change to these values will write/delete to localStorage */
  const storage = useStorage<StoredState>(storageKey, initialState)

  /** force turn off of dark mode, regardless of previously stored settings */
  storage.value.darkMode = false

  /** current token ref, used by `useJwt` to reactively parse our token payload */
  const token = computed({
    get: () => storage.value.token || '',
    set: (val) => (storage.value.token = val),
  })

  /** reactive token payload */
  const { payload } = useJwt<JwtPayload & User>(token.value)

  /** is sidebar open */
  const sidebarOpen = ref(false)

  /** global loading state */
  const isLoading = ref(false)

  return {
    ...toRefs(storage.value),
    token,
    jwtPayload: payload,
    sidebarOpen,
    timestamp,
    isLoading,
  }
}

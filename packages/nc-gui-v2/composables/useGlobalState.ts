import { breakpointsTailwind, usePreferredLanguages, useStorage } from '@vueuse/core'
import { useJwt } from '@vueuse/integrations/useJwt'
import type { JwtPayload } from 'jwt-decode'
import { computed, ref, toRefs, useBreakpoints, useNuxtApp, useTimestamp, watch } from '#imports'
import type { Actions, Getters, GlobalState, StoredState, User } from '~/lib/types'

const storageKey = 'nocodb-gui-v2'

/**
 * Global state is injected by {@link import('~/plugins/state') state} plugin into our nuxt app (available as `$state`).
 * Manual initialization is unnecessary and should be avoided.
 *
 * The state is stored in {@link WindowLocalStorage localStorage}, so it will be available even if the user closes the browser tab.
 *
 * @example
 * ```js
 * import { useNuxtApp } from '#app'
 *
 * const { $state } = useNuxtApp()
 *
 * const token = $state.token.value
 * const user = $state.user.value
 * ```
 */
export const useGlobalState = (): GlobalState => {
  /** get the preferred languages of a user, according to browser settings */
  const preferredLanguages = $(usePreferredLanguages())
  /** todo: reimplement; get the preferred dark mode setting, according to browser settings */
  //   const prefersDarkMode = $(usePreferredDark())

  const prefersDarkMode = false
  /** get current breakpoints (for enabling sidebar) */
  const breakpoints = useBreakpoints(breakpointsTailwind)

  /** reactive timestamp to check token expiry against */
  const timestamp = $(useTimestamp({ immediate: true, interval: 100 }))

  const {
    $api,
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
  const storage = $(useStorage<StoredState>(storageKey, initialState))

  /** current token ref, used by `useJwt` to reactively parse our token payload */
  let token = $computed({
    get: () => storage.token || '',
    set: (val) => (storage.token = val),
  })

  /** reactive token payload */
  const { payload } = $(useJwt<JwtPayload & User>($$(token!)))

  /** Getters */
  /** Verify that a user is signed in by checking if token exists and is not expired */
  const signedIn: Getters['signedIn'] = computed(
    () => !!(!!token && token !== '' && payload && payload.exp && payload.exp > timestamp / 1000),
  )

  /** is sidebar open */
  const sidebarOpen = ref(signedIn.value && breakpoints.greater('md').value)

  /** Actions */
  /** Sign out by deleting the token from localStorage */
  const signOut: Actions['signOut'] = () => {
    storage.token = null
    storage.user = null
  }

  /** Sign in by setting the token in localStorage */
  const signIn: Actions['signIn'] = async (newToken) => {
    token = newToken

    if (payload) {
      storage.user = {
        id: payload.id,
        email: payload.email,
        firstname: payload.firstname,
        lastname: payload.lastname,
        roles: payload.roles,
      }
    }
  }

  /** manually try to refresh token */
  const refreshToken = async () => {
    $api.instance
      .post('/auth/refresh-token', null, {
        withCredentials: true,
      })
      .then((response) => {
        if (response.data?.token) {
          signIn(response.data.token)
        }
      })
      .catch((err) => {
        console.error(err)

        signOut()
      })
  }

  /** try to refresh token before expiry (5 min before expiry) */
  watch(
    () => !!(payload && payload.exp && payload.exp - 5 * 60 < timestamp / 1000),
    async (expiring) => {
      if (signedIn.value && payload && expiring) {
        await refreshToken()
      }
    },
    { immediate: true },
  )

  return { ...toRefs(storage), signedIn, signOut, signIn, sidebarOpen }
}

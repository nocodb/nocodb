import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { useJwt } from '@vueuse/integrations/useJwt'
import type { JwtPayload } from 'jwt-decode'
import { computed, toRefs } from '#build/imports'
import type { Actions, Getters, GlobalState, State, User } from '~/lib/types'

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
  /** get the preferred dark mode setting, according to browser settings */
  const darkMode = $(usePreferredDark())

  /**
   * Split language string and only use the first part, e.g. 'en-GB' -> 'en'
   * todo: use the full language string, e.g. 'en-GB-x-whatever' -> 'en-GB' and confirm if language exists against our list of languages (hint: vite plugin i18n provides a list)
   */
  const preferredLanguage = preferredLanguages[0]?.split('_')[0] || 'en'

  /** State */
  const initialState: State = { token: null, user: null, lang: preferredLanguage, darkMode }

  /** saves a reactive state, any change to these values will write/delete to localStorage */
  const storage = $(useStorage<State>(storageKey, initialState))

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
    () => !!(!!token && token !== '' && payload && payload.exp && payload.exp > Date.now() / 1000),
  )

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

  return { ...toRefs(storage), signedIn, signOut, signIn }
}

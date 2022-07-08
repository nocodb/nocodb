import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { useJwt } from '@vueuse/integrations/useJwt'
import type { JwtPayload } from 'jwt-decode'
import { navigateTo } from '#app'
import { computed, nextTick, toRefs } from '#build/imports'
import type { Actions, Getters, GlobalState, State, User } from '~/lib/types'

const storageKey = 'nocodb-gui-v2'

/**
 * Global State is injected by state plugin, so manual initialization is unnecessary and should be avoided
 */
export const useGlobalState = (): GlobalState => {
  const preferredLanguages = $(usePreferredLanguages())
  const darkMode = $(usePreferredDark())

  const preferredLanguage = preferredLanguages[0]?.split('_')[0] || 'en'

  const initialState: State = { token: null, user: null, lang: preferredLanguage, darkMode }

  const storage = useStorage<State>(storageKey, initialState)

  let token = $computed({
    get: () => storage.value.token || '',
    set: (val) => (storage.value.token = val),
  })

  const { payload } = $(useJwt<JwtPayload & User>($$(token!)))

  // getters
  const signedIn: Getters['signedIn'] = computed(
    () => !!(!!token && token !== '' && payload && payload.exp && payload.exp > Date.now() / 1000),
  )

  // actions
  const signOut: Actions['signOut'] = () => {
    storage.value.token = null
    storage.value.user = null

    navigateTo('/signin')
  }

  const signIn: Actions['signIn'] = async (newToken) => {
    token = newToken

    if (payload) {
      storage.value.user = {
        id: payload.id,
        email: payload.email,
        firstname: payload.firstname,
        lastname: payload.lastname,
        roles: payload.roles,
      }
    }

    await nextTick(() => {
      navigateTo('/')
    })
  }

  return { ...toRefs(storage.value), signedIn, signOut, signIn }
}

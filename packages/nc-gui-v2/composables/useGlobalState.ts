import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { navigateTo } from '#app'
import { useJwt } from '@vueuse/integrations/useJwt'
import { computed, toRefs } from '#build/imports'
import type { Actions, Getters, GlobalState, State } from '~/lib/types'

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

  const token = $ref(storage.value.token)

  const { payload } = useJwt(token!)

  // getters
  const signedIn: Getters['signedIn'] = computed(() => !!(!!token && payload.value && payload.value.exp && payload.value.exp > Date.now() / 1000))

  // actions
  const signOut: Actions['signOut'] = () => {
    storage.value.token = null
    storage.value.user = null
    navigateTo('/signin')
  }

  const signIn: Actions['signIn'] = (user, token) => {
    storage.value.token = token
    storage.value.user = user
    navigateTo('/')
  }

  return { ...toRefs(storage.value), signedIn, signOut, signIn }
}

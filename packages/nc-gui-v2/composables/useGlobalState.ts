import { usePreferredDark, usePreferredLanguages, useStorage } from '@vueuse/core'
import { computed, toRefs } from '#build/imports'
import type { GlobalState, State } from '~/lib/types'

const storageKey = 'nocodb-gui-v2'

/**
 * Global State is injected by state plugin, so manual initialization is unnecessary and should be avoided
 */
export const useGlobalState = (): GlobalState => {
  const preferredLanguages = $(usePreferredLanguages())
  const darkMode = $(usePreferredDark())

  const initialState = { token: undefined, user: undefined, lang: preferredLanguages[0] || 'en', darkMode }

  const storage = useStorage<State>(storageKey, initialState)

  // getters
  const signedIn = computed(() => storage.value.token !== undefined && storage.value.user !== undefined)

  // actions
  function signOut() {
    storage.value.token = undefined
    storage.value.user = undefined
  }

  return { ...toRefs(storage.value), signedIn, signOut }
}

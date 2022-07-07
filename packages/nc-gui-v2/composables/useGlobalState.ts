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

  const preferredLanguage = preferredLanguages[0]?.split('_')[0] || 'en'

  const initialState: State = { token: null, user: null, lang: preferredLanguage, darkMode }

  const storage = useStorage<State>(storageKey, initialState)

  // getters
  const signedIn = computed(() => storage.value.token !== null && storage.value.token !== '' && storage.value.user !== null)

  // actions
  function signOut() {
    storage.value.token = null
    storage.value.user = null
  }

  return { ...toRefs(storage.value), signedIn, signOut }
}

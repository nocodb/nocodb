import { createGlobalState, usePreferredLanguages, useStorage } from '@vueuse/core'
import type { GlobalState } from '~/lib/types'

const storageKey = 'nocodb-gui-v2'

/**
 * Global State is injected by state plugin, so manual initialization is unnecessary and should be avoided
 */
export const useGlobalState = () => {
  const preferredLanguages = $(usePreferredLanguages())
  return createGlobalState(() =>
    useStorage<GlobalState>(storageKey, { token: undefined, user: undefined, lang: preferredLanguages[0] || 'en' }),
  )
}

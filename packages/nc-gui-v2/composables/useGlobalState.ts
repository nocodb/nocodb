import { createGlobalState, usePreferredLanguages, useStorage } from '@vueuse/core'
import type { GlobalState } from '~/lib/types'

const storageKey = 'nocodb-gui-v2'

export const useGlobalState = () => {
  const preferredLanguages = $(usePreferredLanguages())
  return createGlobalState(() =>
    useStorage<GlobalState>(storageKey, { token: undefined, user: undefined, lang: preferredLanguages[0] || 'en' }),
  )
}

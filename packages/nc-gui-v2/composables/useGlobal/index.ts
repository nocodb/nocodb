import { useGlobalState } from './state'
import { useGlobalActions } from './actions'
import type { UseGlobalReturn } from './types'
import { useGlobalGetters } from './getters'
import { toRefs, useNuxtApp, watch } from '#imports'

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
export const useGlobal = (): UseGlobalReturn => {
  const { $state, provide } = useNuxtApp()

  /** If state already exists, return it */
  if (typeof $state !== 'undefined') return $state

  const state = useGlobalState()

  const getters = useGlobalGetters(state)

  const actions = useGlobalActions(state)

  /** try to refresh token before expiry (5 min before expiry) */
  watch(
    () =>
      !!(
        state.jwtPayload.value &&
        state.jwtPayload.value.exp &&
        state.jwtPayload.value.exp - 5 * 60 < state.timestamp.value / 1000
      ),
    async (expiring) => {
      if (getters.signedIn.value && state.jwtPayload.value && expiring) {
        await actions.refreshToken()
      }
    },
    { immediate: true },
  )

  const globalState = { ...state, ...getters, ...actions } as UseGlobalReturn

  /** provide a fresh state instance into nuxt app */
  provide('state', globalState)

  return globalState
}

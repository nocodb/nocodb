import { useGlobalState } from './state'
import { useGlobalActions } from './actions'
import { toRefs, useNuxtApp, watch } from '#imports'
import type { GlobalState } from '~/lib'
import { useGlobalGetters } from '~/composables/useGlobal/getters'

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
export const useGlobal = (): GlobalState => {
  const { $state, provide } = useNuxtApp()

  if ($state) {
    console.warn(
      '[useGlobalState] Global state is injected by state plugin. Manual initialization is unnecessary and should be avoided.',
    )
    return $state
  }

  const state = $(useGlobalState())

  const getters = useGlobalGetters($$(state))

  const actions = useGlobalActions($$(state))

  /** try to refresh token before expiry (5 min before expiry) */
  watch(
    () => !!(state.payload && state.payload.exp && state.payload.exp - 5 * 60 < state.timestamp / 1000),
    async (expiring) => {
      if (getters.signedIn.value && state.payload && expiring) {
        await actions.refreshToken()
      }
    },
    { immediate: true },
  )

  provide('state', state)

  return { ...toRefs(state), ...getters, ...actions }
}

import { useGlobalActions } from './actions'
import { useGlobalGetters } from './getters'
import { useGlobalState } from './state'
import type { UseGlobalReturn } from './types'

/**
 * Global state is injected by {@link import('~/plugins/state') state} plugin into our nuxt app (available as `$state`).
 * You can still call `useGlobal` to receive the `$state` object and access the global state.
 * If it's not available yet, a new global state object is created and injected into the nuxt app.
 *
 * Part of the state is stored in {@link WindowLocalStorage localStorage}, so it will be available even if the user closes the browser tab.
 * Check the {@link StoredState StoredState} type for more information.
 *
 * @example
 * ```js
 *
 *
 * const { $state } = useNuxtApp()
 *
 * const token = $state.token.value
 * const user = $state.user.value
 * ```
 *
 * @example
 * ```js
 *
 *
 * const globalState = useGlobal()
 *
 * cont token = globalState.token.value
 * const user = globalState.user.value
 *
 * console.log(state.isLoading.value) // isLoading = true if any api request is still running
 * ```
 */
export const useGlobal = createGlobalState((): UseGlobalReturn => {
  const { provide } = useNuxtApp()

  const state = useGlobalState()

  const getters = useGlobalGetters(state)

  const actions = useGlobalActions(state)

  watch(
    state.jwtPayload,
    (nextPayload) => {
      if (nextPayload) {
        state.user.value = {
          // keep existing props if user id same as before
          ...(state.user.value?.id === nextPayload.id ? state.user.value || {} : {}),
          id: nextPayload.id,
          email: nextPayload.email,
          firstname: nextPayload.firstname,
          lastname: nextPayload.lastname,
          roles: nextPayload.roles,
          display_name: nextPayload.display_name,
        }
      }
    },
    { immediate: true },
  )

  const globalState = { ...state, ...getters, ...actions } as UseGlobalReturn

  /** provide a fresh state instance into nuxt app */
  provide('state', globalState)

  return globalState
})

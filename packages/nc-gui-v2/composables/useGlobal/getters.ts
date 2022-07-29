import type { Getters, State } from './types'
import { computed } from '#imports'

export function useGlobalGetters(state: State) {
  /** Getters */
  /** Verify that a user is signed in by checking if token exists and is not expired */
  const signedIn: Getters['signedIn'] = computed(
    () =>
      !!(
        !!state.token &&
        state.token.value !== '' &&
        state.jwtPayload.value &&
        state.jwtPayload.value.exp &&
        state.jwtPayload.value.exp > state.timestamp.value / 1000
      ),
  )

  return { signedIn }
}

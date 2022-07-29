import type { UseGlobalStateReturn } from './state'
import type { Getters } from '~/lib'
import { computed } from '#imports'

export function useGlobalGetters(state: UseGlobalStateReturn) {
  /** Getters */
  /** Verify that a user is signed in by checking if token exists and is not expired */
  const signedIn: Getters['signedIn'] = computed(
    () =>
      !!(
        !!state.token &&
        state.token.value !== '' &&
        state.payload.value &&
        state.payload.value.exp &&
        state.payload.value.exp > state.timestamp.value / 1000
      ),
  )

  return { signedIn }
}

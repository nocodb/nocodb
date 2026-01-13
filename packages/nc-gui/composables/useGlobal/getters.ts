import { ref } from 'vue'
import type { Getters, State } from './types'

export function useGlobalGetters(state: State): Getters {
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

  /** Verify that a user is signed in by checking if token exists and is not expired */
  const isSsoUser: Getters['isSsoUser'] = computed(
    () => !!(!!state.token && state.jwtPayload.value && (state.jwtPayload.value as any)?.sso_client_id),
  )

  /** global loading state */
  const loading = ref(false)
  const isLoading = computed({
    get: () => state.runningRequests.count.value > 0 || loading.value,
    set: (_loading) => (loading.value = _loading),
  })

  return { signedIn, isLoading, isSsoUser }
}

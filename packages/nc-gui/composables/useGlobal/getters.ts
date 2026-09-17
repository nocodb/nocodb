import { ref } from 'vue'
import type { User } from 'nocodb-sdk'
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

  /**
   * Like `signedIn`, but derived from the UNMASKED `realToken` so it stays true
   * on shared-view routes when a real login session exists. Used by the
   * "require sign-in" shared form gate/banner (the masked `signedIn` is always
   * false there, which would loop the sign-in redirect forever).
   */
  const signedInReal: Getters['signedInReal'] = computed(
    () =>
      !!(
        !!state.realToken.value &&
        state.realToken.value !== '' &&
        state.jwtPayloadReal.value &&
        state.jwtPayloadReal.value.exp &&
        state.jwtPayloadReal.value.exp > state.timestamp.value / 1000
      ),
  )

  /** The real logged-in user (from the unmasked token), or null. */
  const signedInUserReal: Getters['signedInUserReal'] = computed(() => {
    if (!signedInReal.value || !state.jwtPayloadReal.value) return null

    const p = state.jwtPayloadReal.value

    return {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      meta: (p as any).meta,
    } as User
  })

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

  const getResponsiveValue = <T>(mobile: T, desktop: T): T => {
    return state.isMobileMode.value ? mobile : desktop
  }

  return { signedIn, signedInReal, signedInUserReal, isLoading, isSsoUser, getResponsiveValue }
}

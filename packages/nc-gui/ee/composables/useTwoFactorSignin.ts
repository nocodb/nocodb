import { Auth } from '@aws-amplify/auth'

/**
 * sessionStorage key used to hand a pending two-factor token from one
 * sign-in surface (e.g. the Cognito callback in `useGlobal/actions.ts`)
 * to the page that renders the TOTP input (Signin.vue).
 */
const PENDING_TWO_FACTOR_TOKEN_KEY = 'nc.pendingTwoFactorToken'

/**
 * Shared composable — single instance across all callers in the page
 * tree. The Cognito flow primes the reactive state (and sessionStorage
 * as a hard-reload fallback) so Signin.vue picks up the challenge
 * without remounting. If a second consumer were ever added (e.g. a
 * TOTP step rendered inline elsewhere), it must see the same state ref.
 */
export const useTwoFactorSignin = createSharedComposable(() => {
  const { signIn: _signIn } = useGlobal()

  const { api } = useApi({ useGlobalInstance: true })

  const { $e } = useNuxtApp()

  const twoFactorRequired = ref(false)
  const twoFactorToken = ref('')
  const twoFactorCode = ref('')
  const twoFactorError = ref('')
  const twoFactorLoading = ref(false)
  const useBackupCode = ref(false)
  const postVerifyRedirect = ref<string | undefined>(undefined)
  // Which sign-in path raised the 2FA challenge. cancelTwoFactor needs
  // this to clean up source-specific session state (drop the still-
  // active Cognito session for the SSO path so the next route eval
  // doesn't immediately re-stage the same prompt).
  const twoFactorSource = ref<'cognito' | 'password' | null>(null)

  /**
   * Stage a 2FA token from a non-form sign-in path (today: Cognito).
   * Writes to sessionStorage AND flips the reactive state so an
   * already-mounted Signin.vue switches to the TOTP UI without
   * remounting — `navigateTo('/signin')` from `/signin` is a no-op
   * in the SPA case (same URL), so the `onBeforeMount` hydration
   * path doesn't re-run. sessionStorage stays for the hard-reload
   * case where the user refreshes the page after staging.
   */
  function stagePendingToken(token: string) {
    if (!token) return
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(PENDING_TWO_FACTOR_TOKEN_KEY, token)
    }
    twoFactorRequired.value = true
    twoFactorToken.value = token
    twoFactorSource.value = 'cognito'
    $e('c:signin:2fa-prompted', { source: 'cognito' })
  }

  /**
   * Pick up a token deposited by another sign-in path (today: Cognito)
   * during a hard reload. SPA flows do NOT rely on this — they call
   * `stagePendingToken` directly so the reactive state updates without
   * needing the consuming page to remount. Returns true if the token
   * was found and consumed.
   */
  function hydrateFromPendingToken(): boolean {
    if (typeof window === 'undefined') return false
    const pending = window.sessionStorage.getItem(PENDING_TWO_FACTOR_TOKEN_KEY)
    if (!pending) return false
    window.sessionStorage.removeItem(PENDING_TWO_FACTOR_TOKEN_KEY)
    twoFactorRequired.value = true
    twoFactorToken.value = pending
    twoFactorSource.value = 'cognito'
    $e('c:signin:2fa-prompted', { source: 'cognito' })
    return true
  }

  /**
   * Handle the signin API response. Returns true if 2FA is required
   * (caller should show the TOTP input), false if signin is complete.
   */
  function handleSigninResponse(response: any): boolean {
    if (response.twoFactorRequired) {
      twoFactorRequired.value = true
      twoFactorToken.value = response.twoFactorToken
      twoFactorSource.value = 'password'
      $e('c:signin:2fa-prompted')
      return true
    }

    _signIn(response.token!)
    return false
  }

  async function verifyTwoFactor(): Promise<boolean> {
    if (!twoFactorCode.value) return false

    twoFactorError.value = ''
    twoFactorLoading.value = true

    try {
      const response = await api.instance.post('/api/v2/auth/mfa/verify', {
        token: twoFactorToken.value,
        code: twoFactorCode.value,
      })

      _signIn(response.data.token)
      // BE echoes the deep-link the user was originally heading to (if
      // the entry point captured it — currently only the Cognito path).
      // Expose it so the caller can navigate, rather than mutating
      // router state from inside the composable.
      postVerifyRedirect.value = response.data.redirect
      // BE also echoes the sign-in-flow `extra` payload (OIDC strategy
      // state — e.g. `continueAfterSignIn` from the Cognito callback).
      // Re-apply the parts the FE auth middleware looks for in
      // localStorage so the post-signin redirect works the same way it
      // would have without the 2FA detour.
      if (typeof window !== 'undefined' && response.data.extra?.continueAfterSignIn) {
        window.localStorage.setItem('continueAfterSignIn', response.data.extra.continueAfterSignIn)
      }
      $e('a:signin:2fa-verified', { method: useBackupCode.value ? 'backup_code' : 'totp' })
      // The challenge is done — clear the shared state so a later
      // logout returning the user to /signin doesn't re-show the TOTP
      // form from leftover flags. Keep `postVerifyRedirect` set so the
      // caller can read it synchronously after this resolves; it gets
      // cleared on full reset (signOut).
      resetState({ keepRedirect: true })
      return true
    } catch (e: any) {
      twoFactorError.value = await extractSdkResponseErrorMsg(e)
      $e('a:signin:2fa-failed', { method: useBackupCode.value ? 'backup_code' : 'totp' })
      return false
    } finally {
      twoFactorLoading.value = false
    }
  }

  function resetState({ keepRedirect = false }: { keepRedirect?: boolean } = {}) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(PENDING_TWO_FACTOR_TOKEN_KEY)
    }
    twoFactorRequired.value = false
    twoFactorToken.value = ''
    twoFactorCode.value = ''
    twoFactorError.value = ''
    twoFactorLoading.value = false
    useBackupCode.value = false
    twoFactorSource.value = null
    if (!keepRedirect) {
      postVerifyRedirect.value = undefined
    }
  }

  /**
   * Full reset, including `postVerifyRedirect`. Called from signOut so
   * the singleton state doesn't carry over into the next sign-in.
   */
  function reset() {
    resetState()
  }

  async function cancelTwoFactor() {
    // Re-entrant guard. Auth.signOut() is a multi-second roundtrip and
    // the Cancel button is a plain anchor without disable semantics; a
    // double-click (or a confused user clicking Cancel + Verify in
    // quick succession) would otherwise queue two flows against a
    // still-valid token. Flip `twoFactorLoading` so the verify button
    // disables and the cancel-handler short-circuits on re-entry.
    if (twoFactorLoading.value) return
    twoFactorLoading.value = true

    $e('c:signin:2fa-cancelled', { source: twoFactorSource.value })

    // Cognito-sourced challenge: the IdP session is still active in
    // Amplify. Without clearing it, the next route eval (z_amplify
    // watch fire, auth middleware re-entry) immediately re-issues
    // `/auth/cognito`, the BE re-stages the 2FA token, and we land
    // straight back on the TOTP prompt — an inescapable loop. Sign
    // the user out of Cognito so Cancel actually returns them to a
    // clean `/signin` (email/password form).
    if (twoFactorSource.value === 'cognito') {
      try {
        await Auth.signOut()
      } catch {
        // Best-effort — even if Amplify sign-out errors, we still
        // reset local state below so the user isn't locked into the
        // TOTP prompt.
      }
    }

    // resetState() clears `twoFactorLoading` along with the rest of the
    // singleton state — no manual unset needed here.
    resetState()
  }

  function toggleBackupCode() {
    useBackupCode.value = !useBackupCode.value
    $e('c:signin:2fa-toggle-backup', { useBackupCode: useBackupCode.value })
  }

  return {
    twoFactorRequired,
    twoFactorToken,
    twoFactorCode,
    twoFactorError,
    twoFactorLoading,
    useBackupCode,
    postVerifyRedirect,
    handleSigninResponse,
    hydrateFromPendingToken,
    stagePendingToken,
    verifyTwoFactor,
    cancelTwoFactor,
    toggleBackupCode,
    reset,
  }
})

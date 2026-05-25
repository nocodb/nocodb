/**
 * sessionStorage key used to hand a pending two-factor token from one
 * sign-in surface (e.g. the Cognito callback in `useGlobal/actions.ts`)
 * to the page that renders the TOTP input (Signin.vue).
 */
const PENDING_TWO_FACTOR_TOKEN_KEY = 'nc.pendingTwoFactorToken'

/**
 * Shared composable — single instance across all callers in the page
 * tree. The Cognito flow primes sessionStorage and navigates; Signin.vue
 * hydrates from it. If a second consumer were ever added (e.g. a TOTP
 * step rendered inline elsewhere), it must see the same state ref.
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

  /**
   * Pick up a token deposited by another sign-in path (today: Cognito).
   * The page hosting the TOTP UI should call this once on mount; if a
   * pending token is found, the caller can render the TOTP step
   * directly without going through `handleSigninResponse`.
   */
  function hydrateFromPendingToken(): boolean {
    if (typeof window === 'undefined') return false
    const pending = window.sessionStorage.getItem(PENDING_TWO_FACTOR_TOKEN_KEY)
    if (!pending) return false
    window.sessionStorage.removeItem(PENDING_TWO_FACTOR_TOKEN_KEY)
    twoFactorRequired.value = true
    twoFactorToken.value = pending
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
      return true
    } catch (e: any) {
      twoFactorError.value = await extractSdkResponseErrorMsg(e)
      $e('a:signin:2fa-failed', { method: useBackupCode.value ? 'backup_code' : 'totp' })
      return false
    } finally {
      twoFactorLoading.value = false
    }
  }

  function cancelTwoFactor() {
    $e('c:signin:2fa-cancelled')
    twoFactorRequired.value = false
    twoFactorToken.value = ''
    twoFactorCode.value = ''
    twoFactorError.value = ''
    twoFactorLoading.value = false
    useBackupCode.value = false
    postVerifyRedirect.value = undefined
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
    verifyTwoFactor,
    cancelTwoFactor,
    toggleBackupCode,
  }
})

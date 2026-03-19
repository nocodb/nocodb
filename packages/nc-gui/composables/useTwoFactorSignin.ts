export function useTwoFactorSignin() {
  const { signIn: _signIn } = useGlobal()

  const { api } = useApi({ useGlobalInstance: true })

  const twoFactorRequired = ref(false)
  const twoFactorToken = ref('')
  const twoFactorCode = ref('')
  const twoFactorError = ref('')
  const twoFactorLoading = ref(false)
  const useBackupCode = ref(false)

  /**
   * Handle the signin API response. Returns true if 2FA is required
   * (caller should show the TOTP input), false if signin is complete.
   */
  function handleSigninResponse(response: any): boolean {
    if (response.twoFactorRequired) {
      twoFactorRequired.value = true
      twoFactorToken.value = response.twoFactorToken
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
      return true
    } catch (e: any) {
      twoFactorError.value = await extractSdkResponseErrorMsg(e)
      return false
    } finally {
      twoFactorLoading.value = false
    }
  }

  function cancelTwoFactor() {
    twoFactorRequired.value = false
    twoFactorToken.value = ''
    twoFactorCode.value = ''
    twoFactorError.value = ''
    twoFactorLoading.value = false
    useBackupCode.value = false
  }

  return {
    twoFactorRequired,
    twoFactorToken,
    twoFactorCode,
    twoFactorError,
    twoFactorLoading,
    useBackupCode,
    handleSigninResponse,
    verifyTwoFactor,
    cancelTwoFactor,
  }
}

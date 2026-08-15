import type { NcErrorType, SsoFailureCode } from 'nocodb-sdk'

export interface SsoError {
  type: NcErrorType | SsoFailureCode
  message: string
  /** Log correlation id — set when the backend redirected here after a failed sign-in. */
  ref?: string
}

export const useSsoError = () => {
  const ssoError = useState<SsoError | null>('ssoError', () => null)

  const setError = (error: SsoError | null) => {
    ssoError.value = error
  }

  const clearError = () => {
    ssoError.value = null
  }

  return {
    ssoError,
    setError,
    clearError,
  }
}

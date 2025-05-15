import type { NcErrorType } from 'nocodb-sdk'

export interface SsoError {
  type: NcErrorType
  message: string
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

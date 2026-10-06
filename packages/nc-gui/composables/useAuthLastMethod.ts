import { useSessionStorage, useStorage } from '@vueuse/core'

export type AuthLastMethod = 'email' | 'google' | 'oidc' | 'saml' | 'sso'

const lastMethod = useStorage<AuthLastMethod | ''>('nc-auth-last-method', '')

// a provider click only stages the method: a cancelled redirect must not move the badge
const pendingMethod = useSessionStorage<AuthLastMethod | ''>('nc-auth-pending-method', '')

/** The org SSO client used last; staged and committed alongside `sso`. */
export const lastSsoClientId = useStorage<string>('nc-sso-last-client', '')

const pendingSsoClientId = useSessionStorage<string>('nc-sso-pending-client', '')

/** An SSO / OAuth redirect is starting: it commits on return, a cancel leaves the badge alone. */
export function stageAuthMethod(method: AuthLastMethod, ssoClientId?: string) {
  pendingMethod.value = method
  pendingSsoClientId.value = ssoClientId ?? ''
}

/** A sign-in finished with `method`; drops any staged provider so it can't overwrite this later. */
export function commitAuthMethod(method: AuthLastMethod) {
  if (method === 'sso' && pendingSsoClientId.value) lastSsoClientId.value = pendingSsoClientId.value
  pendingMethod.value = ''
  pendingSsoClientId.value = ''
  lastMethod.value = method
}

/** A redirect sign-in finished: keep the staged provider, else `fallback`. */
export function commitPendingAuthMethod(fallback?: AuthLastMethod) {
  const method = pendingMethod.value || fallback
  if (method) commitAuthMethod(method)
}

/** The sign-in method used last on this browser, for the "Last used" badge on the auth screens. SSO clients keep their own. */
export function useAuthLastMethod() {
  // set from the Cognito token and the SSO callback; covers browsers that predate `lastMethod`
  const { lastUsedAuthMethod } = useGlobal()

  const { $e } = useNuxtApp()

  function isLastUsed(method: AuthLastMethod) {
    return (lastMethod.value || lastUsedAuthMethod.value) === method
  }

  /** A provider button was clicked: record it, and stage it until the sign-in completes. */
  function selectMethod(method: AuthLastMethod, screen: 'signin' | 'signup') {
    $e('c:auth:provider:select', { provider: method, screen, lastUsed: isLastUsed(method) })
    stageAuthMethod(method)
  }

  return { isLastUsed, selectMethod }
}

import { useStorage } from '@vueuse/core'

export type AuthLastMethod = 'email' | 'google' | 'oidc' | 'saml' | 'sso'

/** The sign-in method used last on this browser, for the "Last used" badge on the auth screens. SSO clients keep their own. */
export function useAuthLastMethod() {
  const lastMethod = useStorage<AuthLastMethod | ''>('nc-auth-last-method', '')

  // set from the Cognito token and the SSO callback; covers browsers that predate `lastMethod`
  const { lastUsedAuthMethod } = useGlobal()

  const { $e } = useNuxtApp()

  function isLastUsed(method: AuthLastMethod) {
    return (lastMethod.value || lastUsedAuthMethod.value) === method
  }

  /** A provider button was clicked: record it, then remember it for the badge. */
  function selectMethod(method: AuthLastMethod, screen: 'signin' | 'signup') {
    $e('c:auth:provider:select', { provider: method, screen, lastUsed: isLastUsed(method) })
    lastMethod.value = method
  }

  return { lastMethod, isLastUsed, selectMethod }
}

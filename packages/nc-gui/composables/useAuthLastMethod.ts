import { useStorage } from '@vueuse/core'

export type AuthLastMethod = 'email' | 'google' | 'oidc' | 'saml' | 'sso'

/** The sign-in method used last on this browser, for the "Last used" badge on the auth screens. SSO clients keep their own. */
export function useAuthLastMethod() {
  const lastMethod = useStorage<AuthLastMethod | ''>('nc-auth-last-method', '')

  return { lastMethod }
}

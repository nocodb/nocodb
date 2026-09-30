/** The page sign-in should return to, from the URL first, then what `/signin` or `/signup` stored. */
export function pendingContinueAfterSignIn(query?: Record<string, any>): string | null {
  const fromQuery = query?.continueAfterSignIn

  if (typeof fromQuery === 'string' && fromQuery) return fromQuery

  try {
    return localStorage?.getItem('continueAfterSignIn') ?? null
  } catch {
    return null
  }
}

/**
 * An SSO client URL that also carries where sign-in started. It rides through
 * the IdP (OIDC state, SAML RelayState) and comes back on the redirect, so an
 * invite link survives even when localStorage does not.
 */
export function ssoUrlWithContinue(url: string, continueAfterSignIn?: string | null): string {
  if (!continueAfterSignIn) return url

  try {
    const next = new URL(url, window.location.origin)
    next.searchParams.set('continueAfterSignIn', continueAfterSignIn)
    return next.toString()
  } catch {
    return url
  }
}

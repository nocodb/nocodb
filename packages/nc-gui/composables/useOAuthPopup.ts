import type { FormBuilderOAuthMeta } from 'nocodb-sdk'

/**
 * The OAuth authorization-code popup dance (PKCE), extracted from the
 * form-builder OAuth field so other surfaces can run it too — e.g. the
 * per-user "Connect your account" card, which performs the same dance but
 * sends the code to the connect op instead of embedding it in a form config.
 *
 * `performOAuthDance(oauthMeta, templateData?)` opens the provider popup and
 * resolves `{ code, code_verifier }` on success, `null` when the user
 * cancelled (popup closed / consent denied) — errors beyond cancellation are
 * surfaced via toast AND return `null`, so callers only proceed on a payload.
 */
export function useOAuthPopup() {
  const generateState = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  // PKCE code verifier (43-128 characters)
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // PKCE code challenge (SHA256 hash of the verifier)
  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /** Replace `{{path.to.value}}` templates in the auth URI (e.g. a subdomain). */
  const resolveAuthUri = (authUri: string, templateData?: Record<string, any>) => {
    if (!authUri || !templateData) return authUri

    return authUri.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getNestedValue(templateData, path.trim())
      return value !== undefined && value !== null ? String(value) : match
    })
  }

  /**
   * Most authUris carry a query string already (`?client_id=…`), but some — a
   * GitHub App install URL, say — have none, and a leading `&` there produces a
   * URL the provider 404s on. Every append goes through this, so the two
   * call sites cannot disagree about the separator again.
   */
  function appendParams(url: string, params: Record<string, string>) {
    const query = new URLSearchParams(params).toString()

    if (!query) return url

    return `${url}${url.includes('?') ? '&' : '?'}${query}`
  }

  const openPopup = (
    oauthMeta: FormBuilderOAuthMeta,
    url: string,
    state: string,
    codeVerifier: string,
    width = 500,
    height = 600,
  ) => {
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2.5

    url = appendParams(url, { state })

    const popup = window.open(url, `${oauthMeta.provider} OAuth`, `width=${width},height=${height},left=${left},top=${top}`)
    if (!popup) throw new Error('Popup blocked')

    return new Promise<{ code: string; codeVerifier: string; forwarded: Record<string, string> } | null>((resolve, reject) => {
      let popupClosed = false
      /** Kept from a code-less redirect while the popup goes on to `authorizeUri`. */
      let forwarded: Record<string, string> | undefined
      /** That redirect's URL: polls landing before the popup has left it are not an answer. */
      let handoffUrl: string | undefined

      const interval = setInterval(() => {
        // First check if we already know the popup is closed
        if (popupClosed) {
          clearInterval(interval)
          reject(new Error('Popup closed by user'))
          return
        }

        try {
          // Try to access popup.closed, which might throw in cross-origin scenarios
          popupClosed = popup.closed
          if (popupClosed) {
            clearInterval(interval)
            reject(new Error('Popup closed by user'))
            return
          }

          const popupUrl = popup.location.href

          if (popupUrl === handoffUrl) return

          if (popupUrl.includes(oauthMeta.redirectUri)) {
            const params = new URL(popupUrl).searchParams
            const code = params.get(oauthMeta.codeKey || 'code')

            const landed: Record<string, string> = {}
            for (const key of oauthMeta.forwardKeys ?? []) {
              const value = params.get(key)
              if (value) landed[key] = value
            }

            if (code) {
              clearInterval(interval)

              if (params.get('state') !== state) {
                popup.close()
                reject(new Error('Invalid state please try again'))
                return
              }

              popup.close()
              resolve({ code, codeVerifier, forwarded: { ...forwarded, ...landed } })
            } else if (!forwarded && oauthMeta.authorizeUri && Object.keys(landed).length) {
              // Already installed: GitHub returns the installation but no code, so ask for one.
              forwarded = landed
              handoffUrl = popupUrl
              popup.location.href = appendParams(oauthMeta.authorizeUri, { state })
            } else {
              // If user clicked cancel or code is missing on the redirect url, close the popup
              clearInterval(interval)

              // A redirect that brought the forwarded params is a real answer, not a cancel: say what was missing.
              const got = Object.keys({ ...forwarded, ...landed })
              reject(
                new Error(
                  got.length
                    ? `${oauthMeta.provider} returned ${got.join(', ')} but no authorization code. Try again.`
                    : 'No code returned',
                ),
              )

              popup.close()
            }
          }
        } catch (e) {
          // Handle cross-origin errors — if we can't read popup properties,
          // at least try to detect that it's been closed
          try {
            popupClosed = popup.closed
            if (popupClosed) {
              clearInterval(interval)
              reject(new Error('Popup closed by user'))
            }
          } catch {
            // Completely swallow the error - we'll keep checking
          }
        }
      }, 500)
    })
  }

  const performOAuthDance = async (
    oauthMeta: FormBuilderOAuthMeta,
    templateData?: Record<string, any>,
  ): Promise<{ code: string; code_verifier: string; [key: string]: string } | null> => {
    let url = resolveAuthUri(oauthMeta.authUri, templateData)

    // Unresolved templates mean required fields are missing
    if (!url || url.trim() === '' || (url.includes('{{') && url.includes('}}'))) {
      message.error('Please fill in all required fields before authenticating')
      return null
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    url = appendParams(url, {
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    try {
      const result = await openPopup(oauthMeta, url, generateState(), codeVerifier, 500, 600)

      if (!result) {
        message.error('Failed to authenticate using OAuth')
        return null
      }

      return {
        ...result.forwarded,
        code: result.code,
        code_verifier: result.codeVerifier,
      }
    } catch (e: any) {
      if (e?.message?.includes('Popup closed by user') || e?.message?.includes('No code returned')) {
        return null
      }

      message.error(e?.message || 'Failed to authenticate using OAuth')
      console.error(e)
      return null
    }
  }

  return { performOAuthDance }
}

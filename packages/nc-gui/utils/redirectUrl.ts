/**
 * Validates a shared-form "redirect on submit" URL before it is assigned to
 * `window.location.href` on submit.
 *
 * Security improvement: a naive scheme test like
 * `/^[a-zA-Z][a-zA-Z0-9+.-]*:/` is bypassed by smuggling an ASCII control char
 * into the scheme — `java\tscript:alert(1)` fails the test (treated as a
 * "relative" URL and allowed), yet the browser strips the tab and executes it
 * as `javascript:` in the nocodb origin → stored XSS / token theft.
 *
 * This helper closes that gap by (1) rejecting any URL containing ASCII control
 * chars, and (2) deciding the allow/deny on the *normalized* protocol via the
 * WHATWG URL parser — only `http(s)` schemed URLs and scheme-less (relative)
 * URLs are allowed.
 */
export function isSafeRedirectUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false

  const trimmed = rawUrl.trim()
  if (!trimmed) return false

  // Reject any ASCII control char (incl. tab/newline/CR, which browsers strip
  // from URL schemes — the scheme-smuggling vector this guards against).
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return false
  }

  // Scheme-less (relative) URLs are allowed — they stay on the current origin.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return true

  // Schemed URLs: allow only http(s), judged on the normalized protocol.
  try {
    const { protocol } = new URL(trimmed)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

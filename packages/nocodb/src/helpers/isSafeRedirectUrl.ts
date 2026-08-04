/**
 * Validates a shared-form "redirect on submit" URL.
 *
 * Server-side defense-in-depth (security improvement): the redirect target is
 * stored on the form view and later assigned to `window.location.href` in every
 * submitter's browser. A naive scheme test is bypassed by smuggling an ASCII
 * control char into the scheme (`java\tscript:alert(1)`) — the browser strips
 * the tab and executes it as `javascript:` in the nocodb origin (stored XSS).
 *
 * This rejects any URL containing ASCII control chars and allows only http(s)
 * schemed URLs (judged on the normalized protocol) plus scheme-less (relative)
 * URLs. Mirrors the frontend guard in `nc-gui/utils/redirectUrl.ts`.
 */
export function isSafeRedirectUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;

  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  // Reject any ASCII control char (incl. tab/newline/CR, which browsers strip
  // from URL schemes — the scheme-smuggling vector this guards against).
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }

  // Scheme-less (relative) URLs are allowed — they stay on the current origin.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return true;

  // Schemed URLs: allow only http(s), judged on the normalized protocol.
  try {
    const { protocol } = new URL(trimmed);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

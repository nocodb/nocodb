/**
 * Whether an OAuth redirect_uri is a safe http(s) URL.
 *
 * `z.string().url()` and the WHATWG URL constructor accept opaque schemes
 * (`javascript:`, `data:`, …) which execute in our origin once assigned to
 * `window.location`. RFC 6749 §3.1.2 requires http(s).
 */
export function isHttpRedirectUri(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.trim() === '') return false;
  // Reject ASCII control chars (tab/newline/CR) used to smuggle a scheme past
  // naive parsers — browsers strip them and execute the real scheme.
  for (let i = 0; i < uri.length; i++) {
    const code = uri.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  try {
    const { protocol } = new URL(uri);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Whether `uri` is an acceptable redirect target for a client that registered
 * `registeredUris` — an http(s) URL AND an exact match against the list.
 *
 * RFC 6749 §4.1.2.1 makes this a precondition of *every* redirect the authorize
 * endpoint builds, not just of minting a code: the user-denied and server_error
 * branches must not redirect to an unregistered host either.
 *
 * Kept here rather than inline in the service so it stays dependency-light and
 * unit-testable without the model graph.
 */
export function isRegisteredRedirectUri(
  registeredUris: unknown,
  uri: unknown,
): boolean {
  if (!isHttpRedirectUri(uri)) return false;
  if (!Array.isArray(registeredUris)) return false;
  // Exact match — no normalization, no prefix/suffix tolerance.
  return registeredUris.includes(uri);
}

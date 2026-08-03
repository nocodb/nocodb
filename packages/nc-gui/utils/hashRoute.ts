/**
 * Resolve a legacy hash-fragment route to its clean-URL equivalent.
 *
 * Old bookmarks and embed snippets carry the route in the fragment
 * (`/#/signin`, `/dashboard/#/nc/view/<uuid>`). The fragment is never sent to
 * the server, so both the redirect plugin and the iframe guard have to resolve
 * it client-side — they share this one implementation so the open-redirect guard
 * below cannot drift between them.
 *
 * @returns the clean path (always leading `/`), or null when the hash does not
 *          look like a route.
 */
export function extractLegacyHashRoute(hash?: string): string | null {
  const rawHash = hash ?? (typeof window === 'undefined' ? '' : window.location.hash)

  // Only treat it as a route when it looks like one (starts with `#/`).
  if (!rawHash || !rawHash.startsWith('#/')) return null

  const [hashPath, hashQuery] = rawHash.slice(1).split('?')

  // Prevent open redirect via protocol-relative URLs (//attacker.com, /\attacker.com)
  if (/^\/[/\\]/.test(hashPath)) return null

  const cleanPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  return hashQuery ? `${cleanPath}?${hashQuery}` : cleanPath
}

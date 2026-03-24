/**
 * Hash-to-clean-URL redirect plugin.
 *
 * Runs on page load. If the URL contains a hash fragment that looks like
 * a route (e.g. `/#/signin`, `/dashboard/#/nc/view/xxx`), redirect to
 * the equivalent clean URL so old bookmarks and shared links keep working.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const { hash } = window.location

  // Only redirect if hash looks like a route path (starts with #/)
  if (!hash || !hash.startsWith('#/')) return

  // Extract path and query from the hash fragment
  const hashContent = hash.slice(1) // remove leading #
  const [hashPath, hashQuery] = hashContent.split('?')

  // Prevent open redirect via protocol-relative URLs (//attacker.com, /\attacker.com)
  if (/^\/[/\\]/.test(hashPath)) return

  let cleanUrl = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  if (hashQuery) {
    cleanUrl += `?${hashQuery}`
  }

  // Redirect without creating a history entry
  window.location.replace(cleanUrl)
})

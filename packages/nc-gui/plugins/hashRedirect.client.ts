/**
 * Hash-to-clean-URL redirect plugin.
 *
 * Runs on page load. If the URL contains a hash fragment that looks like
 * a route (e.g. `/#/signin`, `/dashboard/#/nc/view/xxx`), redirect to
 * the equivalent clean URL so old bookmarks and shared links keep working.
 *
 * Respects the <base> tag for subpath deployments — if the app is served
 * at /dashboard, redirects to /dashboard/signin instead of /signin.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const { hash } = window.location

  // Only redirect if hash looks like a route path (starts with #/)
  if (!hash || !hash.startsWith('#/')) return

  // Extract path and query from the hash fragment
  const hashContent = hash.slice(1) // remove leading #
  const [hashPath, hashQuery] = hashContent.split('?')

  let cleanPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`

  // Prepend the base path from <base> tag (e.g. '/dashboard')
  const baseTag = document.querySelector('base')
  if (baseTag?.href) {
    const base = new URL(baseTag.href).pathname.replace(/\/+$/, '')
    if (base && base !== '/') {
      cleanPath = `${base}${cleanPath}`
    }
  }

  if (hashQuery) {
    cleanPath += `?${hashQuery}`
  }

  // Redirect without creating a history entry
  window.location.replace(cleanPath)
})

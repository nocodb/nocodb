/**
 * Hash-to-clean-URL redirect plugin.
 *
 * Runs on page load. If the URL contains a hash fragment that looks like
 * a route (e.g. `/#/signin`, `/dashboard/#/nc/view/xxx`), redirect to
 * the equivalent clean URL so old bookmarks and shared links keep working.
 *
 * Resolution (incl. the open-redirect guard) lives in `extractLegacyHashRoute`,
 * shared with `middleware/02.security.global.ts` — which handles the same case
 * for framed legacy embeds, where it races this plugin.
 */
export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const cleanUrl = extractLegacyHashRoute()
  if (!cleanUrl) return

  // Redirect without creating a history entry
  window.location.replace(cleanUrl)
})

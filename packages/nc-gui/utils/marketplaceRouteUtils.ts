/**
 * The store sits above workspaces and orgs, so every store address is absolute
 * and carries no workspace id: `/marketplace`, `/marketplace/@handle`,
 * `/marketplace/<slug>`.
 *
 * Paths rather than route names, because a CE build ships no marketplace pages
 * and `router.push({ name })` throws on a name the router has never seen.
 */
export const MARKETPLACE_PATH = '/marketplace'

export const marketplacePublisherPath = (handle: string) => `${MARKETPLACE_PATH}/@${handle}`

/**
 * Slug-canonical, id as the fallback — `marketplaceListingGet` resolves either
 * at this position, so a rename never 404s and a pre-slug link still opens.
 */
export const marketplaceListingPath = (listing: { id: string; slug?: string | null }) =>
  `${MARKETPLACE_PATH}/${listing.slug || listing.id}`

/** Absolute, for the "share this listing" boxes in the publisher console. */
export const marketplaceListingUrl = (listing: { id: string; slug?: string | null }) =>
  new URL(marketplaceListingPath(listing), window.location.origin).href

/**
 * Whether a history entry is the storefront itself.
 *
 * The store's back button is labelled "Browse apps", so it has to land there.
 * It replays history only when the previous entry IS the storefront — which is
 * the case that keeps a shopper's filters and scroll — and otherwise goes where
 * the label says rather than to whichever page happens to be behind.
 */
export const isMarketplaceBrowseEntry = (path?: string | null) =>
  !!path && (path === MARKETPLACE_PATH || path.startsWith(`${MARKETPLACE_PATH}?`))

/**
 * The publishers you belong to. A static segment beside `@[handle]` and
 * `[listingId]`, so it must keep winning over the dynamic one — hence a real
 * page file rather than a query on the storefront.
 */
export const MARKETPLACE_PUBLISHERS_PATH = `${MARKETPLACE_PATH}/publishers`

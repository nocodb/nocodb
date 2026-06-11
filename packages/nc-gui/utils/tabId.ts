import { v4 as uuidv4 } from 'uuid'

/**
 * Per-tab UUID. Sent as `x-nc-tab-id` on every internal API call so the
 * server can scope per-tab state — Cmd-Z in tab A doesn't see edits made
 * in tab B for the same user+base.
 *
 * Generated fresh per page load (module-level constant). sessionStorage is
 * NOT used because browsers copy it on tab-duplicate / Cmd-click / window.open,
 * which would yield the same id across two tabs. Module-level state can't be
 * copied that way — each tab loads its own bundle.
 *
 * Trade-off: a page reload generates a new id, so undo/redo doesn't survive
 * reloads. Acceptable for a Cmd-Z UX.
 *
 * Must match the server's `x-nc-tab-id` regex (UUID shape, 8-4-4-4-12 hex).
 * `crypto.randomUUID()` requires a secure context — older Safari, non-HTTPS
 * pages, and some embedded WebViews lack it, so we fall back to the `uuid`
 * package which produces the same shape. A free-form fallback would silently
 * fail the server regex and disable undo/redo for users on those environments.
 */
const TAB_ID =
  typeof window === 'undefined'
    ? ''
    : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidv4()

export function getTabId(): string {
  return TAB_ID
}

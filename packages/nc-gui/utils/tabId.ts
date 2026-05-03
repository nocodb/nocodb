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
 */
const TAB_ID =
  typeof window === 'undefined'
    ? ''
    : typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `t_${Math.random().toString(36).slice(2)}_${Date.now()}`

export function getTabId(): string {
  return TAB_ID
}

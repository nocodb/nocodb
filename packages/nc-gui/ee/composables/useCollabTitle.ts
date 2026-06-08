import type * as Y from 'yjs'

/**
 * Two-way binding between the plain document title `<input>` and a `Y.Text` that
 * lives in the document's shared Y.Doc — the same Y.Doc the Collaboration
 * extension binds the body to. This makes the title co-edit in real time exactly
 * like the body, riding the existing sync channel (no extra socket event). The
 * server derives `nc_docs.title` from this `Y.Text` on its debounced persist
 * (`documentCollabPersist`).
 *
 * Direction handling:
 * - Local edits (the input's v-model `title` ref) are pushed to the `Y.Text` as a
 *   minimal prefix/suffix diff, so concurrent edits at different offsets merge via
 *   CRDT instead of clobbering each other.
 * - Remote edits are reflected back into the `title` ref with best-effort caret
 *   preservation when the input is focused.
 *
 * Binding is dormant until {@link activate} runs (after the initial sync), so the
 * REST-loaded title assigned during document load never leaks into — or seeds a
 * duplicate of — the already-synced shared `Y.Text`.
 */
export function useCollabTitle(opts: {
  ydoc: Y.Doc
  /** The title input's v-model. Editor convention: empty string for "Untitled". */
  title: Ref<string>
  /** Accessor for the title input element (used for caret preservation). */
  getInputEl: () => HTMLInputElement | null | undefined
  /**
   * Called with the normalized title (empty → 'Untitled') whenever it changes,
   * so the caller can patch the documents store (sidebar / breadcrumb / URL slug).
   */
  onTitle?: (normalized: string) => void
}) {
  const { ydoc, title, getInputEl, onTitle } = opts

  const ytitle = ydoc.getText('title')

  // Marks Y.Text transactions we originate so our own observer skips them.
  const ORIGIN = 'collab-title'

  // Dormant until the first sync completes (see activate()).
  let active = false

  // Guard: suppress the title-watch → Y.Text push while we write a remote value
  // into the `title` ref, so a remote edit isn't echoed straight back.
  let applyingRemote = false

  const normalize = (s: string) => s || 'Untitled'

  /** Apply the minimal prefix/suffix diff of `next` over the current Y.Text. */
  function pushDiff(next: string) {
    const cur = ytitle.toString()
    if (next === cur) return

    let start = 0
    const min = Math.min(cur.length, next.length)
    while (start < min && cur[start] === next[start]) start++

    let endCur = cur.length
    let endNext = next.length
    while (endCur > start && endNext > start && cur[endCur - 1] === next[endNext - 1]) {
      endCur--
      endNext--
    }

    ydoc.transact(() => {
      if (endCur > start) ytitle.delete(start, endCur - start)
      if (endNext > start) ytitle.insert(start, next.slice(start, endNext))
    }, ORIGIN)
  }

  /** Map an old caret offset onto the new string after a single-region edit. */
  function remapCaret(oldStr: string, newStr: string, caret: number) {
    let start = 0
    const min = Math.min(oldStr.length, newStr.length)
    while (start < min && oldStr[start] === newStr[start]) start++
    if (caret <= start) return caret
    const delta = newStr.length - oldStr.length
    return Math.min(newStr.length, Math.max(start, caret + delta))
  }

  // Local (user typing) → Y.Text. Sync flush so `applyingRemote` is still set
  // when this fires from within the observer below.
  const stopWatch = watch(
    title,
    (val) => {
      if (!active || applyingRemote) return
      const next = val || ''
      pushDiff(next)
      onTitle?.(normalize(next))
    },
    { flush: 'sync' },
  )

  // Y.Text → local. Skips our own edits; reflects everyone else's.
  const observer = (_event: Y.YTextEvent, txn: Y.Transaction) => {
    if (!active || txn.origin === ORIGIN) return

    const next = ytitle.toString()
    const prev = title.value || ''
    if (next === prev) {
      onTitle?.(normalize(next))
      return
    }

    const el = getInputEl()
    const focused = !!el && document.activeElement === el
    const caret = focused ? el!.selectionStart ?? next.length : null

    applyingRemote = true
    title.value = next
    applyingRemote = false

    onTitle?.(normalize(next))

    if (focused && caret !== null) {
      const newCaret = remapCaret(prev, next, caret)
      nextTick(() => {
        const cur = getInputEl()
        if (cur && document.activeElement === cur) cur.setSelectionRange(newCaret, newCaret)
      })
    }
  }
  ytitle.observe(observer)

  /**
   * Enable the binding once the document has synced. If the shared `Y.Text`
   * already holds a title (the server had one, or a peer seeded it) it is adopted
   * into the input; an empty shared title is left for a later seed / remote edit
   * to fill. Idempotent — call once per sync.
   */
  function activate() {
    if (active) return
    active = true

    if (ytitle.length === 0) return

    const shared = ytitle.toString()
    if ((title.value || '') !== shared) {
      applyingRemote = true
      title.value = shared
      applyingRemote = false
    }
    onTitle?.(normalize(shared))
  }

  /**
   * Seed the shared `Y.Text` from the loaded title when it is still empty. Only
   * the server-granted bootstrap client should call this — two clients seeding
   * concurrently would merge into a duplicated title. Safe to call after (and
   * only after) {@link activate}; no-ops once the shared title is non-empty.
   */
  function seedIfEmpty(loadedTitle: string) {
    if (ytitle.length > 0) return
    const seed = loadedTitle || ''
    if (seed) pushDiff(seed) // origin ORIGIN → propagates to server + peers
  }

  /**
   * Overwrite the shared title (e.g. a revision restore). Unlike seedIfEmpty
   * this applies even when the shared title is non-empty. Must run after
   * activate(); propagates to the server + peers via the ORIGIN transaction.
   */
  function setTitle(next: string) {
    const val = next || ''
    pushDiff(val)
    // Mirror to the local ref so the input updates; applyingRemote stops the
    // watch from echoing this back into pushDiff.
    applyingRemote = true
    title.value = val
    applyingRemote = false
    onTitle?.(normalize(val))
  }

  function destroy() {
    stopWatch()
    ytitle.unobserve(observer)
  }

  onScopeDispose(destroy)

  return { ytitle, activate, seedIfEmpty, setTitle, destroy }
}

/**
 * Custom find & replace for the document editor.
 *
 * No TipTap search extension exists, so we build a ProseMirror plugin
 * from scratch and wrap it as a TipTap extension.
 *
 * Architecture:
 *   SearchState (query, flags, matches[], activeIndex)
 *     ↕  stored in ProseMirror plugin state (immutable per transaction)
 *   SearchMeta  (discriminated union on `type`)
 *     ↕  passed via `tr.setMeta()` from TipTap commands
 *   DecorationSet
 *     ↕  built from matches on every state change
 *
 * The UI component (DocSearchReplace.vue) reads state via
 * `searchPluginKey.getState()` and drives changes through the
 * TipTap commands listed below.
 *
 * Commands exposed:
 *   setSearchQuery(q)                            — update the search term
 *   setSearchOptions({ caseSensitive?, regex? })  — toggle flags
 *   nextMatch()  / prevMatch()                    — cycle active match + scroll
 *   replaceCurrent(text)                          — replace active match
 *   replaceAll(text)                              — replace all matches (single undo step)
 *   clearSearch()                                 — reset state, remove decorations
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'

// ── Types ────────────────────────────────────────────────────────────────

interface SearchMatch {
  from: number // Absolute document position (inclusive)
  to: number // Absolute document position (exclusive)
}

interface SearchState {
  query: string
  caseSensitive: boolean
  regex: boolean
  matches: SearchMatch[] // All matches in document order
  activeIndex: number // Index into `matches` for the current/highlighted match
  truncated: boolean // True when scan stopped at MAX_MATCHES — UI should show "N+"
}

// Hard cap on matches to keep decoration cost bounded. A 4MB document with
// repeated text can produce 200k+ matches; rendering that many inline
// decorations freezes the editor. Beyond this cap the user should refine
// their query anyway. UI shows the count as "1000+" when this is hit.
const MAX_MATCHES = 1000

// ── Plugin key (exported for DocSearchReplace.vue to read state) ─────────
// The key is a singleton — safe to share across editor instances because
// ProseMirror uses it only as a lookup token, not to store state.

export const searchPluginKey = new PluginKey<SearchState>('docSearch')

// ── Helpers ──────────────────────────────────────────────────────────────

const DEFAULT_STATE: SearchState = {
  query: '',
  caseSensitive: false,
  regex: false,
  matches: [],
  activeIndex: 0,
  truncated: false,
}

/**
 * Walk the document and collect all text ranges that match the query.
 *
 * For each text block we concatenate the text content of all inline
 * children (so bold/italic/link spans don't break cross-mark matching)
 * and use the segment list itself as the offset map — translating a
 * char index back to an absolute doc position is a small linear scan
 * over segment boundaries. The previous implementation allocated one
 * array slot per character, which OOM-risked on giant single-block docs.
 *
 * Stops at `MAX_MATCHES` so decoration count stays bounded.
 */
function findMatches(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
  isRegex: boolean,
): { matches: SearchMatch[]; truncated: boolean } {
  if (!query) return { matches: [], truncated: false }

  const matches: SearchMatch[] = []
  let truncated = false

  let pattern: RegExp
  try {
    const flags = caseSensitive ? 'g' : 'gi'
    pattern = isRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags)
  } catch {
    // Invalid regex (e.g. unclosed group) — return empty rather than crash
    return { matches: [], truncated: false }
  }

  doc.descendants((node, pos) => {
    if (truncated) return false
    if (!node.isTextblock) return

    // Gather text segments with their absolute start positions and
    // cumulative char offset within the concatenated block text.
    // `childOffset` is the offset within the parent node's content;
    // `pos + 1` accounts for the parent's opening tag position.
    const segments: { from: number; text: string; charStart: number }[] = []
    let charCursor = 0

    node.forEach((child, childOffset) => {
      if (child.isText && child.text) {
        segments.push({ from: pos + 1 + childOffset, text: child.text, charStart: charCursor })
        charCursor += child.text.length
      }
      // Non-text inline nodes (images, etc.) are skipped — they don't
      // contribute to the searchable text of the block.
    })

    if (!segments.length) return false

    // Concatenate all segments into one string for regex matching
    const blockText = segments.map((s) => s.text).join('')

    // Char index → absolute doc position via segment lookup.
    // Most text blocks have 1–3 segments, so a linear scan is faster
    // than building a per-character lookup array.
    const charToPos = (charIdx: number): number => {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (charIdx < seg.charStart + seg.text.length) {
          return seg.from + (charIdx - seg.charStart)
        }
      }
      const last = segments[segments.length - 1]
      return last.from + last.text.length
    }

    // Run the regex over the concatenated block text
    let m: RegExpExecArray | null
    pattern.lastIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((m = pattern.exec(blockText)) !== null) {
      if (m[0].length === 0) {
        // Prevent infinite loop on zero-length matches (e.g. `.*`)
        pattern.lastIndex++
        continue
      }
      matches.push({
        from: charToPos(m.index),
        to: charToPos(m.index + m[0].length - 1) + 1,
      })
      if (matches.length >= MAX_MATCHES) {
        truncated = true
        return false
      }
    }

    // Stop descending into this textblock's children — we've already
    // processed all text content via node.forEach above.
    return false
  })

  return { matches, truncated }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build inline decorations for all matches (yellow) with the active match in orange. */
function buildDecorations(doc: ProseMirrorNode, state: SearchState): DecorationSet {
  if (!state.matches.length) return DecorationSet.empty

  const decorations = state.matches.map((match, i) =>
    Decoration.inline(match.from, match.to, {
      class: i === state.activeIndex ? 'nc-search-match-active' : 'nc-search-match',
    }),
  )

  return DecorationSet.create(doc, decorations)
}

// ── Meta actions ─────────────────────────────────────────────────────────
// Commands communicate with the plugin via transaction metadata.
// Each meta value is a discriminated union keyed on `type`.

type SearchMeta =
  | { type: 'setQuery'; query: string }
  | { type: 'setOptions'; caseSensitive?: boolean; regex?: boolean }
  | { type: 'nextMatch' }
  | { type: 'prevMatch' }
  | { type: 'clear' }

// ── Factory: creates a fresh ProseMirror plugin per editor instance ──────
// Must NOT be a module-level singleton — each TipTap editor needs its own
// plugin instance so plugin state is independent across editor lifecycles.

function createSearchPlugin() {
  return new Plugin<SearchState>({
    key: searchPluginKey,

    state: {
      init(): SearchState {
        return { ...DEFAULT_STATE }
      },

      apply(tr: Transaction, prevState: SearchState, _oldEditorState: EditorState, newEditorState: EditorState): SearchState {
        const meta = tr.getMeta(searchPluginKey) as SearchMeta | undefined

        // Clear → full reset (called when the search bar closes)
        if (meta?.type === 'clear') {
          return { ...DEFAULT_STATE }
        }

        const state = { ...prevState }
        let needRescan = false

        // Query changed → rescan from scratch, reset active index
        if (meta?.type === 'setQuery') {
          state.query = meta.query
          state.activeIndex = 0
          needRescan = true
        }

        // Options changed (case sensitivity, regex) → rescan
        if (meta?.type === 'setOptions') {
          if (meta.caseSensitive !== undefined) state.caseSensitive = meta.caseSensitive
          if (meta.regex !== undefined) state.regex = meta.regex
          state.activeIndex = 0
          needRescan = true
        }

        // Doc changed while a search is active → rescan to keep matches in sync
        if (tr.docChanged && state.query) {
          needRescan = true
        }

        if (needRescan) {
          const result = findMatches(newEditorState.doc, state.query, state.caseSensitive, state.regex)
          state.matches = result.matches
          state.truncated = result.truncated
          // Clamp activeIndex in case matches shrank (e.g. after a replace)
          if (state.matches.length > 0) {
            state.activeIndex = Math.min(state.activeIndex, state.matches.length - 1)
          } else {
            state.activeIndex = 0
          }
        }

        // Navigate — cycle through matches (wraps around)
        if (meta?.type === 'nextMatch' && state.matches.length > 0) {
          state.activeIndex = (state.activeIndex + 1) % state.matches.length
        }

        if (meta?.type === 'prevMatch' && state.matches.length > 0) {
          state.activeIndex = (state.activeIndex - 1 + state.matches.length) % state.matches.length
        }

        return state
      },
    },

    props: {
      decorations(editorState: EditorState) {
        const state = searchPluginKey.getState(editorState)
        if (!state) return DecorationSet.empty
        return buildDecorations(editorState.doc, state)
      },
    },
  })
}

// ── TipTap command type augmentation ─────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docSearch: {
      setSearchQuery: (query: string) => ReturnType
      setSearchOptions: (options: { caseSensitive?: boolean; regex?: boolean }) => ReturnType
      nextMatch: () => ReturnType
      prevMatch: () => ReturnType
      replaceCurrent: (text: string) => ReturnType
      replaceAll: (text: string) => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

// ── TipTap extension ─────────────────────────────────────────────────────

export const DocSearchExtension = Extension.create({
  name: 'docSearch',

  addProseMirrorPlugins() {
    // Fresh plugin per editor instance — avoids stale state across HMR or
    // editor re-creation when navigating between documents.
    return [createSearchPlugin()]
  },

  addCommands() {
    return {
      setSearchQuery:
        (query: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { type: 'setQuery', query } as SearchMeta)
            dispatch(tr)
          }
          return true
        },

      setSearchOptions:
        (options: { caseSensitive?: boolean; regex?: boolean }) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { type: 'setOptions', ...options } as SearchMeta)
            dispatch(tr)
          }
          return true
        },

      nextMatch:
        () =>
        ({ tr, dispatch }) => {
          // Capture editor ref before dispatch — `this.editor` is the TipTap
          // extension context, available inside `addCommands`.
          const editorRef = this.editor
          if (dispatch) {
            tr.setMeta(searchPluginKey, { type: 'nextMatch' } as SearchMeta)
            dispatch(tr)
            // Scroll after state settles (post-dispatch, post-decoration rebuild)
            scheduleMicrotask(() => scrollToActiveMatch(editorRef))
          }
          return true
        },

      prevMatch:
        () =>
        ({ tr, dispatch }) => {
          const editorRef = this.editor
          if (dispatch) {
            tr.setMeta(searchPluginKey, { type: 'prevMatch' } as SearchMeta)
            dispatch(tr)
            scheduleMicrotask(() => scrollToActiveMatch(editorRef))
          }
          return true
        },

      replaceCurrent:
        (text: string) =>
        ({ tr, dispatch, state }) => {
          const searchState = searchPluginKey.getState(state)
          if (!searchState || searchState.matches.length === 0) return false

          const match = searchState.matches[searchState.activeIndex]
          if (!match) return false

          if (dispatch) {
            // Replace the current match text. The plugin's `apply()` will
            // re-scan the doc and update matches automatically.
            tr.insertText(text, match.from, match.to)
            dispatch(tr)
          }
          return true
        },

      replaceAll:
        (text: string) =>
        ({ tr, dispatch, state }) => {
          const searchState = searchPluginKey.getState(state)
          if (!searchState || searchState.matches.length === 0) return false

          if (!dispatch) return true

          // Replace per-block, not per-match.
          //
          // The naive approach (`tr.insertText` once per match) splits the
          // affected text node on every step. When many matches fall in the
          // same giant text block (e.g. a 4MB paragraph of repeated phrases),
          // the synchronous loop produces ~4MB of new strings per step before
          // V8 can GC the intermediates, and the renderer OOMs.
          //
          // Instead: re-run the regex on each affected block's concatenated
          // text, build the replaced content in a single JS string, and apply
          // ONE `replaceWith` step per block. Total allocation is bounded by
          // the doc size, not the match count.
          //
          // Trade-offs:
          // - Marks (bold/italic) on unmatched text in an affected block are
          //   dropped — we rebuild the block as a plain text node. The
          //   original per-match `insertText` preserved adjacent marks; this
          //   version doesn't. Acceptable for the common (mostly-plain) case.
          // - Inline non-text nodes inside an affected block (mentions, etc.)
          //   are also dropped, matching the original behavior when a match
          //   span crossed them.

          // Rebuild pattern with the current options. Using the same source
          // (block-text concatenation) and same flags as `findMatches`, so
          // matches are identical — no PM-position-to-text-index translation
          // needed (which would mishandle blocks with non-text inline nodes).
          let pattern: RegExp
          try {
            const flags = searchState.caseSensitive ? 'g' : 'gi'
            pattern = searchState.regex ? new RegExp(searchState.query, flags) : new RegExp(escapeRegex(searchState.query), flags)
          } catch {
            return false
          }

          interface BlockEdit {
            from: number
            to: number
            newText: string
          }
          const edits: BlockEdit[] = []

          // Honour the MAX_MATCHES cap: only replace the matches that were
          // visible to the user ("1 / 1000+"). Subsequent clicks process the
          // next batch since the doc-changed rescan refills `matches`.
          let budget = searchState.matches.length

          state.doc.descendants((node, pos) => {
            if (budget <= 0) return false
            if (!node.isTextblock) return

            const blockStart = pos + 1
            const blockEnd = pos + 1 + node.content.size

            let blockText = ''
            node.forEach((child) => {
              if (child.isText && child.text) blockText += child.text
            })
            if (!blockText) return false

            pattern.lastIndex = 0
            let newText = ''
            let lastIdx = 0
            let matched = false
            let m: RegExpExecArray | null
            // eslint-disable-next-line no-cond-assign
            while (budget > 0 && (m = pattern.exec(blockText)) !== null) {
              if (m[0].length === 0) {
                pattern.lastIndex++
                continue
              }
              matched = true
              newText += blockText.slice(lastIdx, m.index)
              newText += text
              lastIdx = m.index + m[0].length
              budget--
            }
            if (!matched) return false
            newText += blockText.slice(lastIdx)

            edits.push({ from: blockStart, to: blockEnd, newText })
            return false
          })

          // Apply in reverse so earlier-block positions stay valid as the doc shrinks/grows.
          for (let i = edits.length - 1; i >= 0; i--) {
            const { from, to, newText } = edits[i]
            if (newText.length > 0) {
              tr.replaceWith(from, to, state.schema.text(newText))
            } else {
              tr.delete(from, to)
            }
          }

          dispatch(tr)
          return true
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { type: 'clear' } as SearchMeta)
            dispatch(tr)
          }
          return true
        },
    }
  },
})

// ── Scroll helper ────────────────────────────────────────────────────────

/** Micro-task scheduler — used instead of Vue's `nextTick` since this is a plain .ts file. */
function scheduleMicrotask(fn: () => void) {
  Promise.resolve().then(fn)
}

/** Scroll the editor viewport so the currently active match is visible. */
function scrollToActiveMatch(editor: Editor) {
  const searchState = searchPluginKey.getState(editor.state)
  if (!searchState || !searchState.matches.length) return

  const match = searchState.matches[searchState.activeIndex]
  if (!match) return

  const { view } = editor
  if (!view) return

  try {
    const dom = view.domAtPos(match.from)
    if (dom?.node) {
      const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } catch {
    // Position may be out of range after rapid doc changes — safe to ignore
  }
}

// Re-export types for use in the UI component (DocSearchReplace.vue)
export { type SearchState, type SearchMatch }

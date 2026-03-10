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
}

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
}

/**
 * Walk the document and collect all text ranges that match the query.
 *
 * For each text block we concatenate the text content of all inline
 * children (so bold/italic/link spans don't break cross-mark matching)
 * and build an offset map to translate local character indices back to
 * absolute ProseMirror document positions.
 */
function findMatches(doc: ProseMirrorNode, query: string, caseSensitive: boolean, isRegex: boolean): SearchMatch[] {
  if (!query) return []

  const matches: SearchMatch[] = []

  let pattern: RegExp
  try {
    const flags = caseSensitive ? 'g' : 'gi'
    pattern = isRegex ? new RegExp(query, flags) : new RegExp(escapeRegex(query), flags)
  } catch {
    // Invalid regex (e.g. unclosed group) — return empty rather than crash
    return []
  }

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return

    // Gather text segments with their absolute start positions.
    // `childOffset` is the offset within the parent node's content;
    // `pos + 1` accounts for the parent's opening tag position.
    const segments: { text: string; from: number }[] = []

    node.forEach((child, childOffset) => {
      if (child.isText && child.text) {
        segments.push({ text: child.text, from: pos + 1 + childOffset })
      }
      // Non-text inline nodes (images, etc.) are skipped — they don't
      // contribute to the searchable text of the block.
    })

    if (!segments.length) return

    // Concatenate all segments into one string for regex matching
    const blockText = segments.map((s) => s.text).join('')

    // Build offset map: offsetMap[charIndex] → absolute doc position
    const offsetMap: number[] = []
    let idx = 0
    for (const seg of segments) {
      for (let i = 0; i < seg.text.length; i++) {
        offsetMap[idx++] = seg.from + i
      }
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
      const from = offsetMap[m.index]
      const to = offsetMap[m.index + m[0].length - 1] + 1
      if (from !== undefined && to !== undefined) {
        matches.push({ from, to })
      }
    }

    // Stop descending into this textblock's children — we've already
    // processed all text content via node.forEach above.
    return false
  })

  return matches
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
          state.matches = findMatches(newEditorState.doc, state.query, state.caseSensitive, state.regex)
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

          if (dispatch) {
            // Replace in reverse document order so earlier positions aren't
            // invalidated by length changes from later replacements.
            // All replacements happen in a single transaction → one undo step.
            const sorted = [...searchState.matches].sort((a, b) => b.from - a.from)
            for (const match of sorted) {
              tr.insertText(text, match.from, match.to)
            }
            dispatch(tr)
          }
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

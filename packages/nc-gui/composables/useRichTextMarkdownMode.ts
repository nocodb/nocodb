import { computed, ref } from 'vue'
import { tokensMissingFrom } from '~/utils/collabUtils'

export type RichTextEditorMode = 'rich' | 'markdown'

export interface MarkdownEditState {
  readOnly: boolean
  /** A co-editing session was started for this cell. */
  hasCollab: boolean
  /** The session never materialised, or went stale: saves go through the normal path. */
  collabRefused: boolean
  /** The server owns the cell through the shared document. */
  collabOwnsPersistence: boolean
  /** Other people are in the session. */
  hasPeers: boolean
  /** Reloading the stored value after the session went stale, or that reload failed. */
  reloadLocked: boolean
}

/** Whether words typed in Markdown are missing from what was stored, ignoring Markdown syntax. */
export function markdownWordsMissingFrom(typed: string, stored: string): boolean {
  const words = (text: string) =>
    text
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}\p{N}]+/gu, ''))
      .filter(Boolean)
  return tokensMissingFrom(words(typed), words(stored))
}

/** Whether the Markdown textarea may take edits. */
export function canEditMarkdown(state: MarkdownEditState): boolean {
  if (state.readOnly || state.reloadLocked) return false
  // still deciding who owns the cell
  if (state.hasCollab && !state.collabRefused && !state.collabOwnsPersistence) return false
  // each Markdown edit replaces the whole shared doc and would clobber theirs
  if (state.collabOwnsPersistence && state.hasPeers) return false
  return true
}

/**
 * Rich text / raw Markdown switch for the expanded Long Text editor.
 * Outside co-editing, Markdown edits are saved as typed; the rich editor is reloaded from them on the way back.
 */
const MAX_UNECHOED_SAVES = 50

export function useRichTextMarkdownMode(options: {
  /** The Markdown to show when entering Markdown mode. */
  readMarkdown: () => string
  /** Persist an edit made in Markdown mode. */
  save: (markdown: string) => void
  /** Load Markdown into the rich editor. */
  loadIntoEditor: (markdown: string) => void
}) {
  const mode = ref<RichTextEditorMode>('rich')

  const source = ref('')

  // Edited since entering Markdown mode: external updates stop overwriting the textarea.
  const edited = ref(false)

  // Saves from the textarea not yet echoed back, oldest first, to tell an echo from someone else's change.
  const unechoed: string[] = []

  // A newer value from someone else, arrived after the last edit here.
  let newerExternal: string | undefined

  const isMarkdownMode = computed(() => mode.value === 'markdown')

  function setMode(next: RichTextEditorMode) {
    if (next === mode.value) return

    if (next === 'markdown') {
      source.value = options.readMarkdown() ?? ''
      edited.value = false
      unechoed.length = 0
      newerExternal = undefined
    } else if (edited.value) {
      options.loadIntoEditor(newerExternal ?? source.value)
    }

    mode.value = next
  }

  function updateSource(markdown: string) {
    if (markdown === source.value) return
    source.value = markdown
    edited.value = true
    newerExternal = undefined
    unechoed.push(markdown)
    // echoes may never come (e.g. debounced saves): bound the copies kept on a long cell
    if (unechoed.length > MAX_UNECHOED_SAVES) unechoed.shift()
    options.save(markdown)
  }

  /**
   * Take an external value change while the user hasn't typed in Markdown mode.
   * After typing, the textarea is kept, but switching back loads the newer value.
   */
  function syncSource(markdown: string | null | undefined) {
    if (!isMarkdownMode.value) return
    const value = markdown ?? ''
    if (!edited.value) {
      source.value = value
    } else {
      // echoes arrive in order: this one and every earlier save are done
      const echoed = unechoed.indexOf(value)
      if (echoed !== -1) unechoed.splice(0, echoed + 1)
      else if (value !== source.value) newerExternal = value
    }
  }

  /** Show a value the user can't edit right now (e.g. others are co-editing), dropping local edits. */
  function resetSource(markdown: string | null | undefined) {
    if (!isMarkdownMode.value) return
    source.value = markdown ?? ''
    edited.value = false
    newerExternal = undefined
  }

  return { mode, source, isMarkdownMode, setMode, updateSource, syncSource, resetSource }
}

import { computed, ref } from 'vue'

export type RichTextEditorMode = 'rich' | 'markdown'

/**
 * Rich text / raw Markdown switch for the expanded Long Text editor.
 * Markdown edits are saved as typed; the rich editor is reloaded from them on the way back.
 */
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

  const isMarkdownMode = computed(() => mode.value === 'markdown')

  function setMode(next: RichTextEditorMode) {
    if (next === mode.value) return

    if (next === 'markdown') {
      source.value = options.readMarkdown() ?? ''
      edited.value = false
    } else if (edited.value) {
      options.loadIntoEditor(source.value)
    }

    mode.value = next
  }

  function updateSource(markdown: string) {
    if (markdown === source.value) return
    source.value = markdown
    edited.value = true
    options.save(markdown)
  }

  /** Take an external value change while the user hasn't typed in Markdown mode. */
  function syncSource(markdown: string | null | undefined) {
    if (!isMarkdownMode.value || edited.value) return
    source.value = markdown ?? ''
  }

  /** Show a value the user can't edit right now (e.g. others are co-editing), dropping local edits. */
  function resetSource(markdown: string | null | undefined) {
    if (!isMarkdownMode.value) return
    source.value = markdown ?? ''
    edited.value = false
  }

  return { mode, source, isMarkdownMode, setMode, updateSource, syncSource, resetSource }
}

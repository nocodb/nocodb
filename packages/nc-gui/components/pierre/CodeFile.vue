<script setup lang="ts">
import { DIFFS_TAG_NAME, File } from '@pierre/diffs'
import { onKeyStroke } from '@vueuse/core'
import type { LineAnnotation, PostRenderPhase, SelectedLineRange } from '@pierre/diffs'
import type { Editor as DiffsEditor } from '@pierre/diffs/edit'

/**
 * One syntax-highlighted file, rendered by `@pierre/diffs`, editable in place.
 *
 * The editor entry is loaded on demand: it is a large module, and most of this
 * surface's life is spent reading rather than editing.
 */

interface Props {
  /** Repo-relative path. The library infers the language from it. */
  name: string
  contents: string
  /** Put the surface into edit mode. */
  edit?: boolean
  /** Lines carrying a review note, and what to draw for each. */
  annotations?: LineAnnotation<PierreNoteMetadata>[]
  /** Let the reader drag a line range out of the gutter. */
  selectable?: boolean
  /** Wrap long lines rather than scroll them. */
  wrap?: boolean
  /** A "+" in the gutter on hover that starts a note on that line. */
  gutterUtility?: boolean
  /** Hand each saved note's slot to the caller (`noteSlot`) to render, instead of plain text. */
  customNotes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  edit: false,
  selectable: false,
  wrap: false,
  gutterUtility: false,
  customNotes: false,
})

const emit = defineEmits<{
  /** The editor's text after a keystroke — the draft, not a save. */
  change: [contents: string]
  /** A line range was settled in the gutter; null when cleared. */
  select: [range: SelectedLineRange | null]
  /**
   * The element the library placed at the draft note's line, for the caller to
   * teleport its composer into. Null once that annotation is gone.
   */
  draftSlot: [element: HTMLElement | null]
  /** A saved note's slot, with `customNotes`. */
  noteSlot: [id: string, element: HTMLElement]
  /** The gutter "+" was clicked, or dragged over a range. */
  gutterClick: [range: SelectedLineRange]
  /** The surface has painted, for a caller covering the gap with a loader. */
  rendered: []
}>()

const { isDark } = useTheme()

const root = ref<HTMLDivElement>()

/**
 * The surface must be a `diffs-container`, not the plain host div.
 *
 * `render()` reuses `fileContainer.shadowRoot` if there is one and otherwise
 * attaches a bare one — but the core stylesheet is adopted in the custom
 * element's own constructor. Render into anything else and the shadow root has
 * no CSS at all: the content is there, entirely unstyled, gutter stacked above
 * the code.
 */
const host = ref<HTMLElement>()

let view: File<PierreNoteMetadata> | undefined

let editor: DiffsEditor<'file', PierreNoteMetadata> | undefined

let stopEditing: (() => void) | undefined

/** The whole option set, every time — `setOptions` replaces rather than merges. */
function fileOptions() {
  return {
    themeType: isDark.value ? ('dark' as const) : ('light' as const),
    overflow: props.wrap ? ('wrap' as const) : ('scroll' as const),
    // No "+" while editing: a note there would anchor to text that is still moving.
    enableGutterUtility: props.gutterUtility && !props.edit,
    onGutterUtilityClick: (range: SelectedLineRange) => emit('gutterClick', range),
    stickyHeader: true,
    enableLineSelection: props.selectable,
    onLineSelectionEnd: (range: SelectedLineRange | null) => emit('select', range),
    renderAnnotation,
    onPostRender: (_node: HTMLElement, _view: unknown, phase: PostRenderPhase) => {
      if (phase !== 'unmount') emit('rendered')
    },
    // Without a handler the component reverts the text on every completion,
    // which would throw away the draft the moment edit mode is left.
    onEditComplete: () => 'accept' as const,
  }
}

/** `force`: redraw after an option change; `render()` otherwise skips a file it already drew. */
function renderFile(force = false) {
  if (!view || !host.value) return

  view.render({
    fileContainer: host.value,
    file: { name: props.name, contents: props.contents },
    lineAnnotations: props.annotations ?? [],
    forceRender: force,
  })
}

/**
 * Annotation bodies are review notes typed by the user, so the element is built
 * with `textContent` — the library inserts whatever node comes back as-is.
 *
 * The draft is the exception: an empty slot goes back to the caller, which
 * teleports the composer into it, so the note is written at the line it is
 * about rather than in a bar at the bottom of the pane.
 */
function renderAnnotation(annotation: LineAnnotation<PierreNoteMetadata>) {
  const element = document.createElement('div')
  element.className = 'nc-pierre-annotation'

  if (annotation.metadata.draft) {
    element.classList.add('nc-pierre-annotation-draft')
    emit('draftSlot', element)

    return element
  }

  if (props.customNotes) {
    element.classList.add('nc-pierre-annotation-custom')
    emit('noteSlot', annotation.metadata.id, element)

    return element
  }

  element.textContent = annotation.metadata.body

  return element
}

async function startEditing() {
  if (!view || editor) return

  const { Editor } = await import('@pierre/diffs/edit')

  // The surface may have been torn down or left edit mode while the editor
  // module was in flight.
  if (!view || !props.edit) return

  editor = new Editor<'file', PierreNoteMetadata>('file', {
    onChange: (event) => emit('change', event.file.contents),
  })

  stopEditing = editor.edit(view)
}

function endEditing() {
  stopEditing?.()
  stopEditing = undefined
  editor = undefined
}

onMounted(() => {
  // Built here rather than in the template so Vue never has to be taught the
  // tag, and so the element is upgraded before anything renders into it.
  host.value = document.createElement(DIFFS_TAG_NAME)
  host.value.style.display = 'block'
  root.value?.appendChild(host.value)

  view = new File<PierreNoteMetadata>(fileOptions())

  renderFile()

  if (props.edit) startEditing()
})

onBeforeUnmount(() => {
  endEditing()
  view?.cleanUp()
  view = undefined
  host.value?.remove()
  host.value = undefined
})

watch(
  () => [props.name, props.contents],
  () => {
    // Re-rendering under a live editor would fight it for the document.
    if (editor) return

    renderFile()
  },
)

// `setLineAnnotations` only stores them; the redraw is what places a new note's slot.
watch(
  () => props.annotations,
  (annotations) => {
    if (editor) view?.setLineAnnotations(annotations ?? [])
    else renderFile()
  },
  { deep: true },
)

watch(
  () => props.edit,
  (edit) => {
    view?.setOptions(fileOptions())

    if (edit) {
      startEditing()
      return
    }

    endEditing()
    renderFile(true)
  },
)

watch(
  () => props.wrap,
  () => {
    view?.setOptions(fileOptions())
    if (!editor) renderFile(true)
  },
)

// A saved or dropped note leaves nothing for the selection to point at.
watch(
  () => !!props.annotations?.some((annotation) => annotation.metadata.draft),
  (hasDraft, hadDraft) => {
    if (hadDraft && !hasDraft) view?.setSelectedLines(null)
  },
)

onKeyStroke('Escape', () => view?.setSelectedLines(null))

watch(isDark, (dark) => view?.setThemeType(dark ? 'dark' : 'light'))
</script>

<template>
  <div ref="root" class="nc-pierre-surface h-full w-full overflow-auto nc-scrollbar-thin" data-testid="nc-pierre-code-file" />
</template>

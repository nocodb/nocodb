<script setup lang="ts">
import { DIFFS_TAG_NAME, File } from '@pierre/diffs'
import type { LineAnnotation, SelectedLineRange } from '@pierre/diffs'
import type { Editor as DiffsEditor } from '@pierre/diffs/edit'

/**
 * One syntax-highlighted file, rendered by `@pierre/diffs`, editable in place.
 *
 * The editor entry is loaded on demand: it is a large module, and most of this
 * surface's life is spent reading rather than editing.
 */

interface Annotation {
  id: string
  body: string
  /** The note being written. Its slot is handed back for the composer. */
  draft?: boolean
}

interface Props {
  /** Repo-relative path. The library infers the language from it. */
  name: string
  contents: string
  /** Put the surface into edit mode. */
  edit?: boolean
  /** Lines carrying a review note, and what to draw for each. */
  annotations?: LineAnnotation<Annotation>[]
  /** Let the reader drag a line range out of the gutter. */
  selectable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  edit: false,
  selectable: false,
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

let view: File<Annotation> | undefined

let editor: DiffsEditor<'file', Annotation> | undefined

let stopEditing: (() => void) | undefined

function renderFile() {
  if (!view || !host.value) return

  view.render({
    fileContainer: host.value,
    file: { name: props.name, contents: props.contents },
    lineAnnotations: props.annotations ?? [],
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
function renderAnnotation(annotation: LineAnnotation<Annotation>) {
  const element = document.createElement('div')
  element.className = 'nc-pierre-annotation'

  if (annotation.metadata.draft) {
    element.classList.add('nc-pierre-annotation-draft')
    emit('draftSlot', element)

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

  editor = new Editor<'file', Annotation>('file', {
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

  view = new File<Annotation>({
    themeType: isDark.value ? 'dark' : 'light',
    stickyHeader: true,
    enableLineSelection: props.selectable,
    onLineSelectionEnd: (range) => emit('select', range),
    renderAnnotation,
    // Without a handler the component reverts the text on every completion,
    // which would throw away the draft the moment edit mode is left.
    onEditComplete: () => 'accept',
  })

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

watch(
  () => props.annotations,
  (annotations) => view?.setLineAnnotations(annotations ?? []),
  { deep: true },
)

watch(
  () => props.edit,
  (edit) => {
    if (edit) {
      startEditing()
      return
    }

    endEditing()
    renderFile()
  },
)

watch(isDark, (dark) => view?.setThemeType(dark ? 'dark' : 'light'))
</script>

<template>
  <div ref="root" class="nc-pierre-surface h-full w-full overflow-auto nc-scrollbar-thin" data-testid="nc-pierre-code-file" />
</template>

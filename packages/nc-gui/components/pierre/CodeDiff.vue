<script setup lang="ts">
import { DIFFS_TAG_NAME, FileDiff } from '@pierre/diffs'
import { onKeyStroke } from '@vueuse/core'
import type { DiffLineAnnotation, FileDiffMetadata, PostRenderPhase, SelectedLineRange } from '@pierre/diffs'

/**
 * A read-only two-sided diff, rendered by `@pierre/diffs`.
 *
 * The library owns the DOM inside the host, so the instance is held in a plain
 * local rather than a ref — a Vue proxy around it would wrap every internal
 * node it touches.
 */

interface Props {
  /** Repo-relative path. The library infers the language from it. */
  name: string
  /** The file as it was. Empty for an added file. */
  original?: string
  /** The file as it is. Empty for a deleted file. */
  modified?: string
  /** A file already parsed from a patch; renders its hunks in place of the two sides. */
  fileDiff?: FileDiffMetadata
  /** Two panes, or one column with change markers. */
  split?: boolean
  /** Lines carrying a review note, and what to draw for each. */
  annotations?: DiffLineAnnotation<PierreNoteMetadata>[]
  /** Let the reader drag a line range out of the gutter. */
  selectable?: boolean
  /** Drop the library's own filename bar, for a caller that has one already. */
  hideHeader?: boolean
  /** Wrap long lines rather than scroll them. */
  wrap?: boolean
  /** Highlight the changed words inside a changed line. */
  wordDiff?: boolean
  /** A "+" in the gutter on hover that starts a note on that line. */
  gutterUtility?: boolean
  /** Hand each saved note's slot to the caller (`noteSlot`) to render, instead of plain text. */
  customNotes?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  original: '',
  modified: '',
  fileDiff: undefined,
  split: false,
  selectable: false,
  hideHeader: false,
  wrap: false,
  wordDiff: true,
  gutterUtility: false,
  customNotes: false,
})

const emit = defineEmits<{
  /** A line range was settled in the gutter; null when cleared. */
  select: [range: SelectedLineRange | null]
  /** The draft note's slot, for the caller to teleport its composer into. */
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
 * The surface must be a `diffs-container` — see the note in `CodeFile.vue`.
 * The core stylesheet is adopted in that element's constructor, so rendering
 * into anything else gives a shadow root with no CSS.
 */
const host = ref<HTMLElement>()

let view: FileDiff<PierreNoteMetadata> | undefined

/**
 * The whole option set, every time — `setOptions` replaces rather than merges,
 * so anything left out of a later call is silently lost (the theme first).
 */
function diffOptions() {
  return {
    themeType: isDark.value ? ('dark' as const) : ('light' as const),
    diffStyle: props.split ? ('split' as const) : ('unified' as const),
    // Whitespace-only churn buries the change that matters in a reformatted file.
    lineDiffType: props.wordDiff ? ('word' as const) : ('none' as const),
    overflow: props.wrap ? ('wrap' as const) : ('scroll' as const),
    enableGutterUtility: props.gutterUtility,
    onGutterUtilityClick: (range: SelectedLineRange) => emit('gutterClick', range),
    disableFileHeader: props.hideHeader,
    stickyHeader: true,
    enableLineSelection: props.selectable,
    onLineSelectionEnd: (range: SelectedLineRange | null) => emit('select', range),
    renderAnnotation,
    onPostRender: (_node: HTMLElement, _view: unknown, phase: PostRenderPhase) => {
      if (phase !== 'unmount') emit('rendered')
    },
  }
}

function renderDiff() {
  if (!view || !host.value) return

  if (props.fileDiff) {
    view.render({ fileContainer: host.value, fileDiff: props.fileDiff, lineAnnotations: props.annotations ?? [] })
    return
  }

  view.render({
    fileContainer: host.value,
    oldFile: { name: props.name, contents: props.original },
    newFile: { name: props.name, contents: props.modified },
    lineAnnotations: props.annotations ?? [],
  })
}

/**
 * Annotation bodies are review notes typed by the user, so the element is built
 * with `textContent` — the library inserts whatever node comes back as-is.
 *
 * The draft is the exception — see the note in `CodeFile.vue`.
 */
function renderAnnotation(annotation: DiffLineAnnotation<PierreNoteMetadata>) {
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

onMounted(() => {
  host.value = document.createElement(DIFFS_TAG_NAME)
  host.value.style.display = 'block'
  root.value?.appendChild(host.value)

  view = new FileDiff<PierreNoteMetadata>(diffOptions())

  renderDiff()
})

onBeforeUnmount(() => {
  view?.cleanUp()
  view = undefined
  host.value?.remove()
  host.value = undefined
})

watch(() => [props.name, props.original, props.modified, props.fileDiff], renderDiff)

// `setLineAnnotations` only stores them; the redraw is what places a new note's slot.
watch(() => props.annotations, renderDiff, { deep: true })

// `render()` skips a diff it already drew whatever the options say; `rerender()` forces the redraw.
watch(
  () => [props.split, props.wrap, props.wordDiff, props.gutterUtility, props.selectable, props.hideHeader],
  () => {
    view?.setOptions(diffOptions())
    view?.rerender()
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
  <div ref="root" class="nc-pierre-surface h-full w-full overflow-auto nc-scrollbar-thin" data-testid="nc-pierre-code-diff" />
</template>

<style lang="scss">
// A saved note reads as a card on the line, not a faint strip under it.
.nc-pierre-annotation:not(.nc-pierre-annotation-draft):not(.nc-pierre-annotation-custom) {
  @apply my-2 mx-3 px-3 py-2.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default shadow-sm text-bodyDefaultSm text-nc-content-gray whitespace-pre-wrap;
}
</style>

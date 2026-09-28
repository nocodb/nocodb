<script setup lang="ts">
import { DIFFS_TAG_NAME, FileDiff } from '@pierre/diffs'
import type { DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs'

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
  original: string
  /** The file as it is. Empty for a deleted file. */
  modified: string
  /** Two panes, or one column with change markers. */
  split?: boolean
  /** Lines carrying a review note, and what to draw for each. */
  annotations?: DiffLineAnnotation<NoteMetadata>[]
  /** Let the reader drag a line range out of the gutter. */
  selectable?: boolean
  /** Drop the library's own filename bar, for a caller that has one already. */
  hideHeader?: boolean
}

interface NoteMetadata {
  id: string
  body: string
  /** The note being written. Its slot is handed back for the composer. */
  draft?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  split: false,
  selectable: false,
  hideHeader: false,
})

const emit = defineEmits<{
  /** A line range was settled in the gutter; null when cleared. */
  select: [range: SelectedLineRange | null]
  /** The draft note's slot, for the caller to teleport its composer into. */
  draftSlot: [element: HTMLElement | null]
}>()

const { isDark } = useTheme()

const root = ref<HTMLDivElement>()

/**
 * The surface must be a `diffs-container` — see the note in `CodeFile.vue`.
 * The core stylesheet is adopted in that element's constructor, so rendering
 * into anything else gives a shadow root with no CSS.
 */
const host = ref<HTMLElement>()

let view: FileDiff<NoteMetadata> | undefined

/**
 * The whole option set, every time — `setOptions` replaces rather than merges,
 * so anything left out of a later call is silently lost (the theme first).
 */
function diffOptions() {
  return {
    themeType: isDark.value ? ('dark' as const) : ('light' as const),
    diffStyle: props.split ? ('split' as const) : ('unified' as const),
    // Whitespace-only churn buries the change that matters in a reformatted file.
    lineDiffType: 'word' as const,
    disableFileHeader: props.hideHeader,
    stickyHeader: true,
    enableLineSelection: props.selectable,
    onLineSelectionEnd: (range: SelectedLineRange | null) => emit('select', range),
    renderAnnotation,
  }
}

function renderDiff() {
  if (!view || !host.value) return

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
function renderAnnotation(annotation: DiffLineAnnotation<NoteMetadata>) {
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

onMounted(() => {
  host.value = document.createElement(DIFFS_TAG_NAME)
  host.value.style.display = 'block'
  root.value?.appendChild(host.value)

  view = new FileDiff<NoteMetadata>(diffOptions())

  renderDiff()
})

onBeforeUnmount(() => {
  view?.cleanUp()
  view = undefined
  host.value?.remove()
  host.value = undefined
})

watch(() => [props.name, props.original, props.modified], renderDiff)

watch(
  () => props.annotations,
  (annotations) => view?.setLineAnnotations(annotations ?? []),
  { deep: true },
)

watch(
  () => props.split,
  () => {
    view?.setOptions(diffOptions())
    renderDiff()
  },
)

watch(isDark, (dark) => view?.setThemeType(dark ? 'dark' : 'light'))
</script>

<template>
  <div ref="root" class="nc-pierre-surface h-full w-full overflow-auto nc-scrollbar-thin" data-testid="nc-pierre-code-diff" />
</template>

<style lang="scss">
.nc-pierre-annotation {
  @apply px-3 py-2 text-captionSm text-nc-content-gray-subtle bg-nc-bg-gray-extralight border-l-2 border-nc-border-brand whitespace-pre-wrap;
}
</style>

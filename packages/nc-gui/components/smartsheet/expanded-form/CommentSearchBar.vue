<script setup lang="ts">
/** Search box for a comment list: highlights matches in authors and bodies and steps through them. */
const props = defineProps<{
  /** The scroll container the comments render in. */
  container?: HTMLElement
  /** Re-collect matches when these change (list, rendered text, expansion). */
  refreshOn?: unknown[]
}>()

const emits = defineEmits<{
  (e: 'close'): void
}>()

const query = defineModel<string>('query', { default: '' })

const { $e } = useNuxtApp()

const searchInputRef = ref<HTMLInputElement>()

const SEARCH_HIGHLIGHT = 'nc-comment-search'

const SEARCH_HIGHLIGHT_ACTIVE = 'nc-comment-search-active'

const SEARCH_LINE_BREAK_TAGS = new Set(['BR', 'P', 'DIV', 'LI', 'BLOCKQUOTE'])

const hasHighlightApi = typeof CSS !== 'undefined' && 'highlights' in CSS

// Ranges over the rendered text in document order (oldest first), so mentions match as shown.
const searchMatches = shallowRef<Range[]>([])

const activeMatchIndex = ref(-1)

function clearSearchHighlights() {
  if (!hasHighlightApi) return

  CSS.highlights.delete(SEARCH_HIGHLIGHT)
  CSS.highlights.delete(SEARCH_HIGHLIGHT_ACTIVE)
}

function paintActiveMatch() {
  if (!hasHighlightApi) return

  const range = searchMatches.value[activeMatchIndex.value]

  if (!range) {
    CSS.highlights.delete(SEARCH_HIGHLIGHT_ACTIVE)
    return
  }

  const highlight = new Highlight(range)
  highlight.priority = 1

  CSS.highlights.set(SEARCH_HIGHLIGHT_ACTIVE, highlight)
}

function scrollToActiveMatch() {
  searchMatches.value[activeMatchIndex.value]?.startContainer.parentElement?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  })
}

// `keepPosition`: re-collect after the list changed without jumping away from where the reader is.
function collectSearchMatches(keepPosition = false) {
  clearSearchHighlights()

  const text = query.value.trim()

  if (!text || !props.container) {
    searchMatches.value = []
    activeMatchIndex.value = -1
    return
  }

  // Matched on the original text: lower-casing first can change its length ("İ" → 2 chars) and shift offsets.
  const pattern = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')

  const ranges: Range[] = []

  props.container.querySelectorAll('.nc-comment-author, .nc-comment-body').forEach((el) => {
    // One string per comment, so a match can span bold, links and mentions (each its own text node).
    // Line breaks and blocks add a "\n" that maps to no node; the query is one line, so no match crosses it.
    const segments: { node: Text; start: number }[] = []

    let content = ''

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        segments.push({ node: node as Text, start: content.length })
        content += node.textContent ?? ''
      } else if (SEARCH_LINE_BREAK_TAGS.has(node.nodeName) && content && !content.endsWith('\n')) {
        content += '\n'
      }
    }

    // Last segment starting at or before `offset`; `isEnd` places an end offset at the end of the previous node.
    function locate(offset: number, isEnd: boolean) {
      let found = segments[0]!

      for (const segment of segments) {
        if (isEnd ? segment.start < offset : segment.start <= offset) found = segment
        else break
      }

      return { node: found.node, offset: offset - found.start }
    }

    for (const match of content.matchAll(pattern)) {
      const start = locate(match.index, false)
      const end = locate(match.index + match[0].length, true)

      const range = new Range()
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset)
      ranges.push(range)
    }
  })

  searchMatches.value = ranges

  // Threads read bottom-up: a new search starts at the newest match.
  activeMatchIndex.value =
    keepPosition && activeMatchIndex.value >= 0 ? Math.min(activeMatchIndex.value, ranges.length - 1) : ranges.length - 1

  if (hasHighlightApi && ranges.length) CSS.highlights.set(SEARCH_HIGHLIGHT, new Highlight(...ranges))

  paintActiveMatch()

  if (!keepPosition) scrollToActiveMatch()
}

/** -1 = older (up), 1 = newer (down); wraps around. */
function moveActiveMatch(step: -1 | 1) {
  const total = searchMatches.value.length
  if (!total) return

  activeMatchIndex.value = (activeMatchIndex.value + step + total) % total

  $e('c:comment:search:navigate', { direction: step === -1 ? 'older' : 'newer' })

  paintActiveMatch()
  scrollToActiveMatch()
}

// One listener: several `@keydown` modifiers compile to an array, which AInput's Function prop rejects
function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emits('close')
    return
  }

  if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return

  e.preventDefault()
  moveActiveMatch(e.shiftKey ? 1 : -1)
}

const debouncedCollectSearchMatches = useDebounceFn(() => collectSearchMatches(), 150)

watch(query, () => debouncedCollectSearchMatches())

// New, edited or re-filtered comments re-render the text the ranges point into.
watch(
  () => props.refreshOn ?? [],
  (next, prev) => {
    // The parent passes a fresh array each render; only a changed item means new text.
    if (prev && next.length === prev.length && next.every((item, i) => item === prev[i])) return
    if (query.value.trim()) nextTick(() => collectSearchMatches(true))
  },
)

onMounted(() => {
  nextTick(() => searchInputRef.value?.focus())
})

onBeforeUnmount(() => {
  // The registry is global: an instance that never searched must not erase another's highlights.
  if (searchMatches.value.length) clearSearchHighlights()
})
</script>

<template>
  <a-input
    ref="searchInputRef"
    v-model:value="query"
    allow-clear
    :placeholder="$t('activity.searchComments')"
    class="nc-comment-search-input !h-8 !rounded-lg !text-small"
    data-testid="nc-comment-search-input"
    @keydown="onSearchKeydown"
  >
    <template #prefix>
      <GeneralIcon icon="search" class="h-3.5 w-3.5 mr-1 text-nc-content-gray-muted" />
    </template>
    <template v-if="query.trim()" #suffix>
      <div class="flex items-center gap-0.5">
        <span
          class="nc-comment-search-count text-captionSm text-nc-content-gray-muted tabular-nums px-1 whitespace-nowrap"
          data-testid="nc-comment-search-count"
        >
          {{ searchMatches.length ? activeMatchIndex + 1 : 0 }}/{{ searchMatches.length }}
        </span>
        <NcButton
          type="text"
          size="xxsmall"
          icon-only
          :disabled="!searchMatches.length"
          :aria-label="$t('labels.previous')"
          data-testid="nc-comment-search-prev"
          @click="moveActiveMatch(-1)"
        >
          <template #icon>
            <GeneralIcon icon="ncChevronUp" class="h-3.5 w-3.5" />
          </template>
        </NcButton>
        <NcButton
          type="text"
          size="xxsmall"
          icon-only
          :disabled="!searchMatches.length"
          :aria-label="$t('labels.next')"
          data-testid="nc-comment-search-next"
          @click="moveActiveMatch(1)"
        >
          <template #icon>
            <GeneralIcon icon="ncChevronDown" class="h-3.5 w-3.5" />
          </template>
        </NcButton>
      </div>
    </template>
  </a-input>
</template>

<style lang="scss">
// Same fixed colours as the doc find bar (_doc-content.scss): theme tokens turn yellow orange in dark mode,
// which made the active match indistinguishable. Higher `priority` (set in script) paints the active one on top.
::highlight(nc-comment-search) {
  background-color: rgba(255, 212, 0, 0.4);
  color: inherit;
}

::highlight(nc-comment-search-active) {
  background-color: rgba(255, 150, 0, 0.6);
  color: inherit;
}
</style>

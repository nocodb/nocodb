<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

const emit = defineEmits<{ close: [] }>()

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks, isCreatingFolder, isGroupCollapsed } =
  useBookmarks()

const { isMobileMode } = useGlobal()

const search = ref('')

const isEmpty = computed(() => orderedGroups.value.length === 0)

// Filter items by search; groups whose items all get filtered out simply
// render with an empty body. Width, column count, and minimum height are
// locked to the unfiltered library so the dialog doesn't shift on type.
const filteredBookmarksByGroup = computed<Record<string, BookmarkType[]>>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return bookmarksByGroup.value
  const map: Record<string, BookmarkType[]> = {}
  for (const groupId in bookmarksByGroup.value) {
    map[groupId] = bookmarksByGroup.value[groupId]!.filter((bm) => {
      const title = (bm.title ?? bm.resolved_title ?? '').toLowerCase()
      return title.includes(q)
    })
  }
  return map
})

const hasSearchMatch = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return Object.values(filteredBookmarksByGroup.value).some((list) => list.length > 0)
})

// Drop groups whose items are entirely filtered out — only the matching
// groups should appear during a search.
const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return orderedGroups.value
  return orderedGroups.value.filter((g) => (filteredBookmarksByGroup.value[g.id!]?.length ?? 0) > 0)
})

function onNavigate(bm: BookmarkType) {
  navigateToBookmark(bm)
  emit('close')
}

onMounted(() => {
  loadBookmarks()
})

// Sequential column fill — pack groups into column 1 until the height
// cap is reached, then spill to column 2, then 3 (max). Width grows
// in step so the dialog only takes the room it actually needs.
const ROWS_PER_COL = 12 // tuned so content stays within max-height (720px); groups + items render taller than 32px each, so the previous 20 over-counted and produced a scrollbar
const MAX_COLS = 3
const COL_W = { 1: 380, 2: 540, 3: 700 } as const

// "row" = one visual line. Collapsed groups render as a single header
// row regardless of item count, so the packer must reflect that to keep
// columns visually balanced when the user collapses/expands groups.
function rowsForGroup(g: BookmarkGroupType, items: number): number {
  if (isGroupCollapsed(g.id!)) return 1
  // group header (1) + items (or 1 line for the "No data" empty state)
  return 1 + Math.max(items, 1)
}

// Newspaper-style balanced fill:
// 1) Pick column count by overflow (1 → 2 → 3) against ROWS_PER_COL.
// 2) Then choose split point(s) that minimize the tallest column, so
//    columns end up roughly equal height instead of "fill col 1, fill
//    col 2, dump rest in col 3".
function packGroups(
  groups: BookmarkGroupType[],
  itemCount: (g: BookmarkGroupType) => number,
): { cols: BookmarkGroupType[][]; colCount: 1 | 2 | 3 } {
  if (!groups.length) return { cols: [[]], colCount: 1 }

  // Mobile: always single column — multi-column layouts don't fit.
  if (isMobileMode.value) return { cols: [groups], colCount: 1 }

  const rows = groups.map((g) => rowsForGroup(g, itemCount(g)))
  const total = rows.reduce((a, b) => a + b, 0)

  const desiredCols = Math.min(MAX_COLS, Math.max(1, Math.ceil(total / ROWS_PER_COL)))
  const colCount = Math.min(desiredCols, groups.length) as 1 | 2 | 3
  if (colCount === 1) return { cols: [groups], colCount: 1 }

  // Prefix sums: prefix[k] = sum of rows[0..k-1]. Always defined for k in [0, n].
  const prefix: number[] = [0]
  for (const r of rows) prefix.push((prefix[prefix.length - 1] as number) + r)
  const n = groups.length

  // Helper: brute-search the best split point(s); n is small (< 50).
  if (colCount === 2) {
    let bestI = 1
    let bestMax = Infinity
    for (let i = 1; i < n; i++) {
      const left = prefix[i] as number
      const m = Math.max(left, total - left)
      if (m < bestMax) {
        bestMax = m
        bestI = i
      }
    }
    return { cols: [groups.slice(0, bestI), groups.slice(bestI)], colCount: 2 }
  }

  // colCount === 3
  let bestI = 1
  let bestJ = 2
  let bestMax = Infinity
  for (let i = 1; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = prefix[i] as number
      const b = prefix[j] as number
      const m = Math.max(a, b - a, total - b)
      if (m < bestMax) {
        bestMax = m
        bestI = i
        bestJ = j
      }
    }
  }
  return {
    cols: [groups.slice(0, bestI), groups.slice(bestI, bestJ), groups.slice(bestJ)],
    colCount: 3,
  }
}

// Pack the FILTERED set into the SAME number of columns the unfiltered
// library would use, so search reflows items inside fixed columns rather
// than shrinking the dialog width or merging columns together.
const unfilteredPacked = computed(() => packGroups(orderedGroups.value, (g) => bookmarksByGroup.value[g.id!]?.length ?? 0))

const columnGroups = computed<BookmarkGroupType[][]>(() => {
  const filteredItemCount = (g: BookmarkGroupType) => filteredBookmarksByGroup.value[g.id!]?.length ?? 0
  // Use the unfiltered colCount so search reflows the matching groups across
  // the same number of columns instead of collapsing to a narrower layout.
  return rebalanceToColumns(filteredGroups.value, filteredItemCount, unfilteredPacked.value.colCount)
})

const flyoutWidth = computed<string>(() => {
  // On mobile the desktop COL_W[1] (380px) is often wider than the viewport
  // itself — fill the screen minus the rail and a small breathing margin.
  if (isMobileMode.value) return 'calc(100vw - var(--mini-sidebar-width) - 16px)'
  return `${COL_W[unfilteredPacked.value.colCount]}px`
})

// Even-split helper used to keep the column count stable across filter
// reflows. Always produces exactly `target` columns (possibly empty) by
// re-running the packer with the target enforced via min-max search.
function rebalanceToColumns(
  groups: BookmarkGroupType[],
  itemCount: (g: BookmarkGroupType) => number,
  target: 1 | 2 | 3,
): BookmarkGroupType[][] {
  if (!groups.length) return Array.from({ length: target }, () => [])
  if (target === 1) return [groups]
  if (groups.length <= target) {
    const cols: BookmarkGroupType[][] = []
    for (let i = 0; i < target; i++) cols.push(groups[i] ? [groups[i] as BookmarkGroupType] : [])
    return cols
  }

  const rows = groups.map((g) => rowsForGroup(g, itemCount(g)))
  const total = rows.reduce((a, b) => a + b, 0)
  const prefix: number[] = [0]
  for (const r of rows) prefix.push((prefix[prefix.length - 1] as number) + r)
  const n = groups.length

  if (target === 2) {
    let bestI = 1
    let bestMax = Infinity
    for (let i = 1; i < n; i++) {
      const left = prefix[i] as number
      const m = Math.max(left, total - left)
      if (m < bestMax) {
        bestMax = m
        bestI = i
      }
    }
    return [groups.slice(0, bestI), groups.slice(bestI)]
  }

  // target === 3
  let bestI = 1
  let bestJ = 2
  let bestMax = Infinity
  for (let i = 1; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = prefix[i] as number
      const b = prefix[j] as number
      const m = Math.max(a, b - a, total - b)
      if (m < bestMax) {
        bestMax = m
        bestI = i
        bestJ = j
      }
    }
  }
  return [groups.slice(0, bestI), groups.slice(bestI, bestJ), groups.slice(bestJ)]
}
</script>

<template>
  <div class="nc-bookmark-flyout" :style="{ width: flyoutWidth }" @click.stop @keydown.stop>
    <BookmarksHeader v-model:search="search" :is-empty="isEmpty" />

    <BookmarksCreateFolderRow v-if="isCreatingFolder" />

    <div class="nc-bookmark-body nc-scrollbar-thin">
      <div v-if="isLoading" class="nc-bookmark-loader">
        <GeneralLoader />
      </div>

      <div v-else-if="isEmpty && !isCreatingFolder" class="nc-bookmark-empty">
        <GeneralIcon icon="ncBookmark" class="w-8 h-8 text-nc-content-gray-subtle" />
        <span class="text-bodyDefaultSm text-nc-content-gray-muted text-center px-4">
          {{ $t('msg.noBookmarksYet') }}
        </span>
      </div>

      <div v-else-if="!isEmpty && search.trim() && !hasSearchMatch" class="nc-bookmark-noresults">
        {{ $t('labels.noResults') }}
      </div>

      <BookmarksListLayout
        v-else
        :groups="filteredGroups"
        :column-groups="columnGroups"
        :bookmarks-by-group="filteredBookmarksByGroup"
        @navigate="onNavigate"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-flyout {
  @apply fixed flex flex-col;
  @apply bg-nc-bg-default dark:bg-nc-bg-gray-extralight;
  @apply border-1 border-nc-border-gray-medium rounded-xl shadow-lg;
  left: calc(var(--mini-sidebar-width) - 1px);
  bottom: 18px;
  /* fixed dialog height — same regardless of library size, content
     reflows / scrolls inside. Capped against the viewport for short screens. */
  height: min(80vh, 720px);
  z-index: 50;
  transition: width 0.2s ease;
}
.nc-bookmark-body {
  @apply flex-1 overflow-y-auto overflow-x-hidden;
}
.nc-bookmark-loader {
  @apply flex items-center justify-center py-8;
}
.nc-bookmark-empty {
  @apply flex flex-col items-center justify-center py-8 gap-2;
}
.nc-bookmark-noresults {
  @apply text-bodySm text-nc-content-gray-muted text-center py-6;
}
</style>

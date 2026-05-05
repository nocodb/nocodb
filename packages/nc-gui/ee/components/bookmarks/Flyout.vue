<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

const emit = defineEmits<{ close: [] }>()

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks, isCreatingFolder } = useBookmarks()

const search = ref('')

const isEmpty = computed(() => orderedGroups.value.length === 0)

const filteredBookmarksByGroup = computed<Record<string, BookmarkType[]>>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return bookmarksByGroup.value
  const map: Record<string, BookmarkType[]> = {}
  for (const groupId in bookmarksByGroup.value) {
    const filtered = bookmarksByGroup.value[groupId].filter((bm) => {
      const title = (bm.title ?? bm.resolved_title ?? '').toLowerCase()
      return title.includes(q)
    })
    if (filtered.length) map[groupId] = filtered
  }
  return map
})

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return orderedGroups.value
  return orderedGroups.value.filter((g) => filteredBookmarksByGroup.value[g.id!]?.length)
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
const ROWS_PER_COL = 20 // ~ flyout max-height (720px) ÷ row height (32px) ÷ header overhead
const MAX_COLS = 3
const COL_W = { 1: 380, 2: 540, 3: 700 } as const

// "row" = one visual line: a group header, an item, or an empty-state line.
function rowsForGroup(g: BookmarkGroupType): number {
  const items = filteredBookmarksByGroup.value[g.id!]?.length ?? 0
  // group header (1) + items (or 1 line for the "No data" empty state)
  return 1 + Math.max(items, 1)
}

const columnGroups = computed<BookmarkGroupType[][]>(() => {
  const cols: BookmarkGroupType[][] = [[]]
  let used = 0
  for (const g of filteredGroups.value) {
    const r = rowsForGroup(g)
    if (used > 0 && used + r > ROWS_PER_COL && cols.length < MAX_COLS) {
      cols.push([])
      used = 0
    }
    cols[cols.length - 1].push(g)
    used += r
  }
  return cols
})

const flyoutWidth = computed(() => COL_W[columnGroups.value.length as 1 | 2 | 3] ?? COL_W[1])
</script>

<template>
  <div
    class="nc-bookmark-flyout"
    :style="{ width: `${flyoutWidth}px` }"
    @click.stop
    @keydown.stop
  >
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

      <div v-else-if="!isEmpty && search.trim() && !filteredGroups.length" class="nc-bookmark-noresults">
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
  left: 60px;
  bottom: 18px;
  /* size to content; cap so we don't overflow the viewport */
  max-height: min(80vh, 720px);
  z-index: 50;
  transition: width 0.2s ease;
}
.nc-bookmark-body {
  @apply flex-1 overflow-y-auto overflow-x-hidden pb-3;
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

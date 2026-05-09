<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

const emit = defineEmits<{ close: [] }>()

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks, isCreatingFolder } = useBookmarks()

const { isMobileMode } = useGlobal()

const search = ref('')

const isEmpty = computed(() => orderedGroups.value.length === 0)

// Filter items by search; groups whose items all get filtered out simply
// render with an empty body.
const filteredBookmarksByGroup = computed<Record<string, BookmarkType[]>>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return bookmarksByGroup.value
  const map: Record<string, BookmarkType[]> = {}
  for (const groupId in bookmarksByGroup.value) {
    map[groupId] = bookmarksByGroup.value[groupId]!.filter((bm) => {
      const title = (bm.title ?? '').toLowerCase()
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

// Always render as a single column — ListLayout still expects a 2D
// array, so wrap the filtered groups in one outer slot.
const columnGroups = computed<BookmarkGroupType[][]>(() => [filteredGroups.value])

const FLYOUT_WIDTH_PX = 380

// Mobile fills the screen minus the rail and a small breathing margin;
// desktop is fixed-width.
const flyoutWidth = computed<string>(() =>
  isMobileMode.value ? 'calc(100vw - var(--mini-sidebar-width) - 16px)' : `${FLYOUT_WIDTH_PX}px`,
)
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

<script setup lang="ts">
import type { BookmarkType } from 'nocodb-sdk'

const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks } = useBookmarks()

const emit = defineEmits<{ close: [] }>()

const router = useRouter()

const goToSettings = () => {
  router.push('/account/bookmarks')
  emit('close')
}

// Distribute groups across 3 columns (top-to-bottom, then next column)
const columns = computed(() => {
  const cols: typeof orderedGroups.value[] = [[], [], []]
  const heights = [0, 0, 0]

  for (const group of orderedGroups.value) {
    const itemCount = (bookmarksByGroup.value[group.id!] ?? []).length
    const groupHeight = 1 + itemCount // 1 for title + item count

    // Find shortest column
    let minIdx = 0
    for (let i = 1; i < 3; i++) {
      if (heights[i] < heights[minIdx]) minIdx = i
    }

    cols[minIdx].push(group)
    heights[minIdx] += groupHeight
  }

  return cols
})

const isEmpty = computed(() => orderedGroups.value.length === 0)

function onNavigate(bm: BookmarkType) {
  navigateToBookmark(bm)
  emit('close')
}

onMounted(() => {
  loadBookmarks()
})
</script>

<template>
  <div
    class="nc-bookmarks-flyout fixed bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl shadow-lg z-50 flex flex-col"
    style="left: 60px; bottom: 18px; width: 760px; max-height: 80vh"
    @click.stop
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b-1 border-nc-border-gray-medium flex-none">
      <span class="text-sm font-bold text-nc-content-gray">{{ $t('title.bookmarks') }}</span>
      <div class="flex items-center gap-1">
        <BookmarksAddBookmarkDropdown />
        <NcButton type="text" size="xxsmall" class="!rounded-md" @click="goToSettings">
          <GeneralIcon icon="settings" class="text-nc-content-gray-muted" />
        </NcButton>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-3.5">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <GeneralLoader />
      </div>

      <!-- Empty state -->
      <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-8 gap-2">
        <GeneralIcon icon="ncBookmark" class="w-8 h-8 text-nc-content-gray-subtle" />
        <span class="text-sm text-nc-content-gray-subtle text-center px-4">{{ $t('msg.noBookmarksYet') }}</span>
      </div>

      <!-- 3-column grid -->
      <div v-else class="grid grid-cols-3 gap-x-5 gap-y-4">
        <div v-for="(col, colIdx) in columns" :key="colIdx" class="flex flex-col gap-4">
          <BookmarksFlyoutGroup
            v-for="group in col"
            :key="group.id"
            :group="group"
            :bookmarks="bookmarksByGroup[group.id!] ?? []"
            :all-groups="orderedGroups"
            @navigate="onNavigate"
          />
        </div>
      </div>
    </div>
  </div>
</template>

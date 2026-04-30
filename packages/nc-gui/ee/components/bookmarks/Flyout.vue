<script setup lang="ts">
const { bookmarksByGroup, orderedGroups, isLoading, navigateToBookmark, loadBookmarks } = useBookmarks()

const emit = defineEmits<{ close: [] }>()

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

onMounted(() => {
  loadBookmarks()
})
</script>

<template>
  <div
    class="nc-bookmarks-flyout fixed bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl shadow-lg z-50 p-3.5"
    style="left: 60px; bottom: 18px; width: 760px; max-height: 80vh; overflow-y: auto"
    @click.stop
  >
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <GeneralLoader />
    </div>

    <!-- Empty state -->
    <div v-else-if="isEmpty" class="flex flex-col items-center justify-center py-8 gap-2">
      <GeneralIcon icon="ncBookmark" class="w-8 h-8 text-nc-content-gray-subtle" />
      <span class="text-sm text-nc-content-gray-subtle">{{ $t('labels.noData') }}</span>
    </div>

    <!-- 3-column grid -->
    <div v-else class="grid grid-cols-3 gap-x-5 gap-y-4">
      <div v-for="(col, colIdx) in columns" :key="colIdx" class="flex flex-col gap-4">
        <div v-for="group in col" :key="group.id" class="flex flex-col gap-0.5">
          <!-- Group title -->
          <div class="text-[11px] font-semibold text-nc-content-gray-subtle px-1.5 mb-1.5">
            {{ group.name }}
          </div>

          <!-- Bookmark items -->
          <BookmarksItem
            v-for="bm in bookmarksByGroup[group.id!]"
            :key="bm.id"
            :bookmark="bm"
            @click="navigateToBookmark(bm); emit('close')"
          />

          <!-- Empty group -->
          <div
            v-if="!(bookmarksByGroup[group.id!]?.length)"
            class="text-xs text-nc-content-gray-muted px-1.5 py-1"
          >
            {{ $t('labels.noData') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

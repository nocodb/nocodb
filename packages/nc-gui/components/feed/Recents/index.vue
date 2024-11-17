<script setup lang="ts">
const { socialFeed, loadFeed, isErrorOccurred, isNewFeedAvailable } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadFeed({
      type: 'all',
      loadMore: true,
    })
  },
  { distance: 1, interval: 2000 },
)

onMounted(() => {
  isNewFeedAvailable.value = false
  const [latestFeed] = socialFeed.value
  if (latestFeed) localStorage.setItem('lastFeedPublishedTime', latestFeed['Published Time'])
})
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3.1rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md w-full"
  >
    <div v-if="isErrorOccurred?.social && !socialFeed.length" class="h-full flex justify-center items-center">
      <FeedError page="all" />
    </div>
    <div v-else-if="isLoading && !socialFeed.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="flex flex-col my-6 items-center gap-6">
      <template v-for="feed in socialFeed" :key="feed.Id">
        <FeedRecentsCard v-if="['Github', 'Cloud', 'Youtube'].includes(feed['Feed Source'])" :item="feed" />
      </template>
    </div>
  </div>
</template>

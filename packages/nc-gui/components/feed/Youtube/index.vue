<script setup lang="ts">
const { youtubeFeed, loadFeed, isErrorOccurred } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadFeed({
      type: 'youtube',
      loadMore: true,
    })
  },
  { distance: 1, interval: 2000 },
)

const gotoChannel = () => {
  window.open('https://www.youtube.com/@nocodb?ref=product_feed', '_blank')
}
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md pt-9 mx-auto w-full"
  >
    <div v-if="isErrorOccurred?.youtube && !youtubeFeed.length" class="h-full flex justify-center items-center">
      <FeedError page="youtube" />
    </div>
    <div v-else-if="isLoading && !youtubeFeed.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="youtube-feed mx-auto">
      <div class="flex gap-3 items-center mt-4 justify-between">
        <span class="text-gray-900 font-semibold"> Recent Videos </span>
        <NcButton type="secondary" size="small" @click="gotoChannel"> Go to Youtube </NcButton>
      </div>

      <div class="flex gap-2 flex-col">
        <FeedYoutubePlayer v-for="feed in youtubeFeed" :key="feed.Id" :item="feed" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.youtube-feed {
  @apply !max-w-[47.75rem];
}
</style>

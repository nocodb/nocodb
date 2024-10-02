<script setup lang="ts">
const { youtubeFeed, loadFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    const data = await loadFeed({
      type: 'youtube',
      loadMore: true,
    })
    youtubeFeed.value = [...youtubeFeed.value, ...data]
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
      height: 'calc(100dvh - var(--toolbar-height) - 5.25rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md mt-9 mx-auto w-full"
  >
    <div v-if="isLoading && !youtubeFeed.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="max-w-[764px] mx-auto">
      <div class="flex gap-3 items-center justify-between">
        <span class="text-gray-900 font-semibold"> Recent Videos </span>
        <NcButton type="secondary" size="small" @click="gotoChannel"> Go to Youtube </NcButton>
      </div>

      <div class="flex gap-2 flex-col">
        <FeedYoutubePlayer v-for="feed in youtubeFeed" :item="feed" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

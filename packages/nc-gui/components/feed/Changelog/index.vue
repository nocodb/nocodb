<script setup lang="ts">
const { loadFeed, githubFeed, isErrorOccurred } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadFeed({
      type: 'github',
      loadMore: true,
    })
  },
  { distance: 4 },
)
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md mx-auto w-full"
  >
    <div v-if="isErrorOccurred?.github && !githubFeed.length" class="h-full flex justify-center items-center">
      <FeedError page="github" />
    </div>
    <div v-else-if="isLoading && !githubFeed.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else class="mx-auto max-w-[540px] xl:max-w-[638px] justify-around justify-items-center">
      <FeedChangelogItem v-for="(feed, index) in githubFeed" :key="feed.Id" :item="feed" :index="index" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

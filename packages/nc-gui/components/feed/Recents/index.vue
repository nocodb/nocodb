<script setup lang="ts">
const { socialFeed, loadFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    const data = (
      await loadFeed({
        type: 'all',
        loadMore: true,
      })
    ).filter((item) => item['Feed Source'] !== 'Twitter')

    socialFeed.value = [...socialFeed.value, ...data]
  },
  { distance: 1, interval: 2000 },
)
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3.1rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md w-full"
  >
    <div v-if="isLoading && !socialFeed.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>
    <div v-else class="flex flex-col my-6 items-center gap-6">
      <FeedRecentsCard v-for="feed in socialFeed" :key="feed.Id" :item="feed" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

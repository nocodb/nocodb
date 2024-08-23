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
      height: 'calc(100dvh - var(--toolbar-height) - 3.25rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md w-full"
  >
    <div class="flex flex-col items-center gap-6">
      <FeedRecentsCard v-for="feed in socialFeed" :key="feed.Id" :item="feed" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

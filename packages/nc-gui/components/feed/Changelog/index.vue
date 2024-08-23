<script setup lang="ts">
const { loadFeed, githubFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    const data = await loadFeed({
      type: 'github',
      loadMore: true,
    })

    githubFeed.value = [...githubFeed.value, ...data]
  },
  { distance: 1, interval: 2000 },
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
    <div class="max-w-260 mx-auto">
      <FeedChangelogItem v-for="feed in githubFeed" :key="feed.Id" :item="feed" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

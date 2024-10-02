<script setup lang="ts">
const { loadGithubFeed, githubFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadGithubFeed(true)
  },
  { distance: 10 },
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
      <FeedChangelogItem v-for="feed in githubFeed" :key="feed.id" :date="feed.published_at" :body="feed?.body" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

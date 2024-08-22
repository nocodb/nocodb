<script setup lang="ts">
import Tweet from 'vue-tweet'

const { twitterFeed, loadFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    const data = await loadFeed({
      type: 'twitter',
      loadMore: true,
    })
    twitterFeed.value = [...twitterFeed.value, ...data]
  },
  { distance: 1 },
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
    <div class="flex items-center flex-col">
      <Tweet v-for="feed in twitterFeed" :key="feed.Id" :tweet-url="feed.Url" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

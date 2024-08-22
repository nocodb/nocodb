<script setup lang="ts">
const { youtubeFeed, loadYoutubeFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadYoutubeFeed(true)
  },
  { distance: 10 },
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
    <div class="max-w-[764px] mx-auto">
      <div class="flex gap-3 items-center justify-between">
        <span class="text-gray-900 font-semibold"> Recent Videos </span>
        <NcButton type="secondary" size="small" @click="gotoChannel"> Go to Youtube </NcButton>
      </div>

      <div class="flex gap-2 flex-col">
        <FeedYoutubePlayer
          v-for="feed in youtubeFeed"
          :key="feed.id"
          :html_url="feed.html_url"
          :name="feed.name"
          :body="feed.body"
          :published_at="feed.published_at"
          :embed_url="feed.embed_url"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

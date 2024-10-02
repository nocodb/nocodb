<script setup lang="ts">
const { youtubeFeed, loadYoutubeFeed } = useProductFeed()

onMounted(() => {
  loadYoutubeFeed()
})
</script>

<template>
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
</template>

<style scoped lang="scss"></style>

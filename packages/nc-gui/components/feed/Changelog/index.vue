<script setup lang="ts">
const { loadGithubFeed, githubFeed } = useProductFeed()

onMounted(async () => {
  await loadGithubFeed()
})
</script>

<template>
  <div class="max-w-260 mx-auto">
    <FeedChangelogItem v-for="feed in githubFeed" :key="feed.id" :date="feed.published_at" :body="feed?.body" />
  </div>
</template>

<style scoped lang="scss"></style>

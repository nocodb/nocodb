<script setup lang="ts">
const releases = ref<
  {
    body: string
    id: string
    published_at: string
  }[]
>([])

const fetchReleaseNotes = async () => {
  const response = await fetch('https://api.github.com/repos/nocodb/nocodb/releases')
  const data = await response.json()
  return data
}

onMounted(async () => {
  releases.value = await fetchReleaseNotes()
})
</script>

<template>
  <FeedChangelogItem v-for="feed in releases" :key="feed.id" :date="feed.published_at" :body="feed?.body" />
</template>

<style scoped lang="scss"></style>

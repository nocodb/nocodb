<script setup lang="ts">
const props = defineProps<{
  page: 'all' | 'youtube' | 'github'
}>()

const { loadFeed, socialFeed, youtubeFeed, githubFeed } = useProductFeed()

const triggerReload = async () => {
  const data = (
    await loadFeed({
      type: props.page,
      loadMore: false,
    })
  ).filter((item) => item['Feed Source'] !== 'Twitter')

  if (props.page === 'all') {
    socialFeed.value = data
  } else if (props.page === 'youtube') {
    youtubeFeed.value = data
  } else if (props.page === 'github') {
    githubFeed.value = data
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 items-center justify-center">
    <GeneralIcon icon="warning" class="text-gray-500 w-8 h-8" />
    <span class="text-gray-600 text-base font-semibold"> Unable to load feed </span>

    <NcButton type="secondary" size="small" @click="triggerReload">
      <div class="flex items-center text-gray-700 gap-2">
        <GeneralIcon icon="refreshCw" />
        <span class="text-sm"> Retry </span>
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss"></style>

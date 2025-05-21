<script setup lang="ts">
const props = defineProps<{
  type: 'github' | 'cloud'
}>()

const { loadFeed, githubFeed, isErrorOccurred, cloudFeed } = useProductFeed()

const scrollContainer = ref<HTMLElement>()

const { isLoading } = useInfiniteScroll(
  scrollContainer,
  async () => {
    if (isLoading.value) return
    await loadFeed({
      type: props.type,
      loadMore: true,
    })
  },
  { distance: 4 },
)

const feeds = computed(() => {
  return props.type === 'github' ? githubFeed.value : cloudFeed.value
})
</script>

<template>
  <div
    ref="scrollContainer"
    :style="{
      height: 'calc(100dvh - var(--toolbar-height) - 3rem)',
    }"
    class="overflow-y-auto nc-scrollbar-md mx-auto w-full"
  >
    <div
      v-if="(props.type === 'github' ? isErrorOccurred.github : isErrorOccurred.cloud) && !feeds.length"
      class="h-full flex justify-center items-center"
    >
      <FeedError :page="type" />
    </div>
    <div v-else-if="isLoading && !feeds.length" class="flex items-center justify-center h-full w-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else class="mx-auto max-w-[540px] xl:max-w-[638px] justify-around justify-items-center">
      <FeedChangelogItem v-for="(item, index) in feeds" :key="item.Id" :item="item" :index="index" />
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'

const { navigateToFeed } = useWorkspace()
const productFeed = useProductFeed()

const { loadFeed } = productFeed

const { socialFeed } = toRefs(productFeed)

const isNewFeedAvailable = ref(false)

const checkNewFeed = async () => {
  await loadFeed({ type: 'all', loadMore: false })
  if (!socialFeed.value.length) return

  const [latestFeed] = socialFeed.value
  const lastFeedTime = localStorage.getItem('lastFeedPublishedTime')
  const lastFeed = dayjs(lastFeedTime)

  if (!lastFeed.isValid() || dayjs(latestFeed['Published Time']).isAfter(lastFeed)) {
    isNewFeedAvailable.value = true
    localStorage.setItem('lastFeedPublishedTime', latestFeed['Published Time'])
  }
}

onMounted(checkNewFeed)

const gotoFeed = () => navigateToFeed()
</script>

<template>
  <div class="px-2 feed-btn py-2">
    <div
      class="flex items-center justify-between text-nc-content-brand py-1.5 cursor-pointer px-3 hover:bg-nc-bg-brand-hover bg-nc-bg-brand rounded-lg"
      @click="gotoFeed"
    >
      <div class="flex items-center gap-3">
        <GeneralIcon icon="megaPhone" />
        <span class="font-semibold">What’s New!</span>
      </div>

      <div v-if="isNewFeedAvailable" class="w-3 h-3 pulsing-dot bg-nc-fill-red-medium border-2 border-white rounded-full"></div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.pulsing-dot {
  animation: pulse 1.5s infinite ease-in-out;
}
</style>

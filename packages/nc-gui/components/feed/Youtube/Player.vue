<script setup lang="ts">
import { YoutubeVue3 } from 'youtube-vue3'
import type { ProductFeedItem } from '../../../lib/types'
import { extractYoutubeVideoId } from '../../../utils/urlUtils'

const props = defineProps<{
  item: ProductFeedItem
  isRecent?: boolean
}>()

const {
  item: { Title, Description, Url },
} = props
</script>

<template>
  <div class="mt-6 border-1 !bg-white recent-card rounded-2xl border-gray-200">
    <YoutubeVue3
      :videoid="extractYoutubeVideoId(Url)"
      class="!rounded-t-xl"
      :height="470"
      :width="764"
      :autoplay="0"
      :controls="1"
    />

    <div class="flex flex-col px-3 py-5 gap-4">
      <div class="text-gray-900 font-bold text-2xl">
        {{ Title }}
      </div>
      <div class="text-gray-900">
        {{ Description.length > 200 ? `${Description.slice(0, 280)}...` : Description }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.prose {
  a {
    @apply !text-gray-900;
  }
}

.recent-card {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}
</style>

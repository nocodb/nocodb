<script setup lang="ts">
import { YoutubeVue3 } from 'youtube-vue3'
import type { ProductFeedItem } from '../../../lib/types'
import { extractYoutubeVideoId } from '../../../utils/urlUtils'

const props = defineProps<{
  item: ProductFeedItem
}>()

const {
  item: { Title, Description, Url },
} = props

const { width } = useWindowSize()

const { $e } = useNuxtApp()

const watchVideo = () => {
  $e('c:nocodb:feed:youtube:watch', {
    title: Title,
    description: Description,
    url: Url,
  })
}
</script>

<template>
  <div class="mt-6 border-1 !bg-white recent-card !rounded-2xl border-gray-200">
    <YoutubeVue3
      :videoid="extractYoutubeVideoId(Url)"
      class="!rounded-t-xl"
      :height="width < 1280 ? 330 : 392"
      :width="width < 1280 ? 538 : 638"
      :autoplay="0"
      :controls="1"
      @played="watchVideo"
    />

    <div class="text-nc-content-gray-emphasis flex flex-col p-5 gap-4">
      <div class="font-bold leading-9 text-2xl">
        {{ Title }}
      </div>
      <div class="text-md leading-5">
        {{ Description.length > 200 ? `${Description.slice(0, 280)}...` : Description }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.recent-card {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}
</style>

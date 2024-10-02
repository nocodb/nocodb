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
  <div class="mt-6 border-b-1 border-gray-200">
    <YoutubeVue3
      :videoid="extractYoutubeVideoId(Url)"
      class="!rounded-xl"
      :height="470"
      :width="764"
      :autoplay="0"
      :controls="1"
    />

    <div class="flex flex-col py-5 gap-4">
      <div class="text-gray-900 font-bold text-2xl">
        {{ Title }}
      </div>
      <div class="text-gray-900">
        {{ Description.length > 200 ? `${Description.slice(0, 280)}...` : Description }}
      </div>
    </div>
  </div>
</template>

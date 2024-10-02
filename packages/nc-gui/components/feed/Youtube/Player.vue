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
  <div class="flex flex-col mt-6 gap-5">
    <YoutubeVue3 :videoid="extractYoutubeVideoId(Url)" :height="470" :width="764" :autoplay="0" :controls="1" />

    <div class="text-gray-900 font-bold text-2xl">
      {{ Title }}
    </div>
    <div class="text-gray-900">
      {{ Description.length > 200 ? `${Description.slice(0, 280)}...` : Description }}
    </div>
  </div>
</template>

<style lang="scss"></style>

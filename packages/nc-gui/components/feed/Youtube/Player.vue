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
  <div class="mt-6 border-1 !bg-white recent-card !rounded-2xl border-gray-200">
    <YoutubeVue3
      :videoid="extractYoutubeVideoId(Url)"
      class="!rounded-t-xl"
      :height="330"
      :width="538"
      :autoplay="0"
      :controls="1"
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

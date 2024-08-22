<script setup lang="ts">
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import type { ProductFeedItem } from '../../../lib/types'

const props = defineProps<{
  item: ProductFeedItem
}>()

const {
  item: { Title, Description, Url },
} = props

const videoPlayer = ref<HTMLElement>()

const player = ref()

onMounted(() => {
  if (!videoPlayer.value) return
  player.value = new Plyr(videoPlayer.value, {
    previewThumbnails: {},
    quality: {
      default: 1080,
      options: [720, 1080, 2160],
    },
  })
})

onBeforeUnmount(() => {
  if (player.value) {
    player.value.destroy()
  }
})
</script>

<template>
  <div class="flex flex-col mt-6 gap-5">
    <div class="aspect-video !rounded-lg mx-auto !h-[428px]">
      <div id="player" ref="videoPlayer" class="plyr__video-embed">
        <iframe
          :src="`${Url}?origin=https://plyr.io&amp;iv_load_policy=3&amp;modestbranding=1&amp;playsinline=1&amp;showinfo=0&amp;rel=0&amp;enablejsapi=1`"
          allowfullscreen
          allowtransparency
          allow="autoplay"
        ></iframe>
      </div>
    </div>
    <div class="text-gray-900 font-bold text-2xl">
      {{ Title }}
    </div>
    <div class="text-gray-900">
      {{ Description.length > 200 ? `${Description.slice(0, 280)}...` : Description }}
    </div>
  </div>
</template>

<style lang="scss">
.plyr--video {
  @apply !rounded-lg;
}
</style>

<script setup lang="ts">
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

defineProps<{
  body: string
  name: string
  published_at: string
  embed_url: string
  html_url: string
}>()

const videoPlayer = ref<HTMLElement>()

const player = ref()

onMounted(() => {
  if (!videoPlayer.value) return
  player.value = new Plyr(videoPlayer.value, {
    previewThumbnails: {},
  })
})

onBeforeUnmount(() => {
  if (player.value) {
    player.value.destroy()
  }
})
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="aspect-video !rounded-lg mx-auto !h-[428px]">
      <div id="player" ref="videoPlayer" class="plyr__video-embed">
        <iframe
          :src="`${embed_url}?origin=https://plyr.io&amp;iv_load_policy=3&amp;modestbranding=1&amp;playsinline=1&amp;showinfo=0&amp;rel=0&amp;enablejsapi=1`"
          allowfullscreen
          allowtransparency
          allow="autoplay"
        ></iframe>
      </div>
    </div>
    <div>
      {{ name }}
    </div>
  </div>
</template>

<style lang="scss">
.plyr--video {
  @apply !rounded-lg;
}
</style>

<script setup lang="ts">
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface Props {
  src?: string[]
  mimeType?: string
  class?: string
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  class: '',
})

const emit = defineEmits<Emits>()

interface Emits {
  (event: 'init', player: any): void
  (event: 'error'): void
}

const videoPlayer = ref<HTMLElement>()

const player = ref()

onMounted(() => {
  if (!videoPlayer.value) return
  player.value = new Plyr(videoPlayer.value, {
    previewThumbnails: {},
  })
  emit('init', player.value)
})

onBeforeUnmount(() => {
  if (player.value) {
    player.value.destroy()
  }
})

const handleError = async () => {
  // `props.src` is an ordered list of candidate URLs for the same file (e.g. presigned first,
  // public/direct URL as fallback). A load failure on the first source doesn't mean the
  // attachment itself is gone — only bubble up to the carousel's reload-on-error flow (which
  // re-fetches the whole row) once every candidate has been confirmed expired/unavailable.
  const results = await Promise.all((props.src ?? []).map((src) => isURLExpired(src)))
  if (results.length > 0 && results.every((r) => r.isExpired)) {
    emit('error')
  }
}
</script>

<template>
  <template v-if="mimeType === 'video/quicktime' && props.src?.length">
    <video
      ref="videoPlayer"
      controls
      playsinline
      :src="props.src[0]"
      :class="{
        [props.class]: props.class,
      }"
      class="videoplayer !min-w-128 !min-h-72 w-full h-auto"
      @error="handleError"
    ></video>
  </template>
  <video
    v-else
    ref="videoPlayer"
    controls
    playsinline
    :class="{
      [props.class]: props.class,
    }"
    class="videoplayer !min-w-128 !min-h-72 w-full h-auto"
    @error="handleError"
  >
    <source v-for="(source, id) in props.src" :key="id" :src="source" :type="mimeType" />
  </video>
</template>

<style lang="scss">
.plyr.plyr--video {
  max-height: 100%;
  height: auto;
}
.plyr > .plyr__video-wrapper {
  display: flex;
}

.plyr video.h-auto {
  height: auto;
}
</style>

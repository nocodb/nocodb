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
</script>

<template>
  <video
    ref="videoPlayer"
    controls
    playsinline
    :class="{
      [props.class]: props.class,
    }"
    class="videoplayer !min-w-128 !min-h-72 w-full"
  >
    <source v-for="(source, id) in props.src" :key="id" :src="source" :type="mimeType" />
  </video>
</template>

<style scoped lang="scss"></style>

<script setup lang="ts">
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'

interface Props {
  src?: string[]
  mimeType?: string
  class?: string
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
  player.value = new Plyr(videoPlayer.value)
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
    crossorigin
    playsinline
    :class="{
      [props.class]: props.class,
    }"
    class="videoplayer h-auto w-full"
  >
    <source v-for="(src, id) in props.src" :key="id" :src="src" :type="mimeType" />
  </video>
</template>

<style scoped lang="scss"></style>

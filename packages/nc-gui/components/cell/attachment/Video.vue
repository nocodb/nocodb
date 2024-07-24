<script setup lang="ts">
import videojs from 'video.js'
import { stripUndefinedOrNull } from '~/utils/objectUtils'
import 'video.js/dist/video-js.css'

interface Props {
  autoplay?: boolean
  controls?: boolean
  height?: string | number
  loop?: boolean
  muted?: boolean
  poster?: string
  preload?: 'auto' | 'metadata' | 'none'
  width?: string | number
  aspectRatio?: string
  audioOnlyMode?: boolean
  audioPosterMode?: boolean
  autoSetup?: boolean
  disablePictureInPicture?: boolean
  enableDocumentPictireInPicture?: boolean
  enableSmoothSeeking?: boolean
  fluid?: boolean
  src?: string
  fullScreen?: {
    options?: {
      navigationUI?: 'hide' | 'show'
      id?: string
    }
  }
  inactivityTimeout?: number
  language?: string
  liveui?: boolean
  notSupportedMessage?: string
  playbackRates?: number[]
  playsinline?: boolean
  plugins?: Record<string, any>
  preferFullWindow?: boolean
  responsive?: boolean
  restoreEl?: Element | boolean
  skipButtons?: {
    forward?: number
    back?: number
  }
  sources?: {
    src: string
    type: string
  }[]
  suppressNotSupportedError?: boolean
  techOrder?: string[]
  userActions?: {
    click?: (event: Event) => void | boolean
    doubleClick?: (event: Event) => void | boolean
    hotkeys?: (event: Event) => void | boolean | Record<string, (event: Event) => void>
  }
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  preload: 'metadata',
  aspectRatio: '16:9',
  controls: true,
  audioOnlyMode: false,
  audioPosterMode: false,
  autoSetup: true,
  disablePictureInPicture: false,
  enableDocumentPictireInPicture: false,
  enableSmoothSeeking: true,
  fluid: true,
  fullScreen: {
    options: {
      navigationUI: 'hide',
      id: undefined,
    },
  },
  language: 'en',
  liveui: false,
  playsinline: true,
  preferFullWindow: false,
  responsive: false,
  restoreEl: false,
})

const emit = defineEmits<Emits>()

interface Emits {
  (event: 'init', player: any): void
}

const videoPlayer = ref<Element>()

const player = ref()

onMounted(() => {
  if (!videoPlayer.value) return
  player.value = videojs(videoPlayer.value, stripUndefinedOrNull(props))
  emit('init', player.value)
})

onBeforeUnmount(() => {
  if (player.value) {
    player.value.dispose()
  }
})
</script>

<template>
  <div
    class="w-full"
    :class="{
      [props.class]: props.class,
    }"
  >
    <video ref="videoPlayer" class="video-js h-full w-full"></video>
  </div>
</template>

<style scoped lang="scss"></style>

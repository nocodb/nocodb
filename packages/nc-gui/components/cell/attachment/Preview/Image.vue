<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

interface Props {
  srcs: string[]
  alt?: string
  objectFit?: string
  controls?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['error'])

const index = ref(0)
const scale = ref(1)
const isDragging = ref(false)
const startPos = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })
const containerRef = ref<HTMLDivElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

const MIN_SCALE = 1
const MAX_SCALE = 4
const ZOOM_STEP = 0.5

const transformStyle = computed(() => ({
  transform: `translate(${position.value.x}px, ${position.value.y}px) scale(${scale.value})`,
  transition: isDragging.value ? 'none' : 'transform 0.2s ease-out',
  cursor: scale.value > 1 ? 'grab' : 'default',
}))

const limitDrag = (x: number, y: number) => {
  if (!containerRef.value || !imageRef.value) return { x, y }

  const containerRect = containerRef.value.getBoundingClientRect()
  const imageRect = imageRef.value.getBoundingClientRect()

  const maxX = (imageRect.width * scale.value - containerRect.width) / 8
  const maxY = (imageRect.height * scale.value - containerRect.height) / 8

  return {
    x: Math.max(Math.min(x, maxX), -maxX),
    y: Math.max(Math.min(y, maxY), -maxY),
  }
}

const onError = async () => {
  index.value++
  if (index.value >= props.srcs.length) {
    const isURLExp = await isURLExpired(props.srcs[0])
    if (isURLExp.isExpired) {
      emit('error')
    }
  }
}

const zoom = (direction: 'in' | 'out') => {
  const newScale =
    direction === 'in' ? Math.min(scale.value + ZOOM_STEP, MAX_SCALE) : Math.max(scale.value - ZOOM_STEP, MIN_SCALE)

  scale.value = newScale
  if (newScale === MIN_SCALE) {
    position.value = { x: 0, y: 0 }
  }
}

const startDrag = (clientX: number, clientY: number) => {
  if (scale.value <= 1) return
  isDragging.value = true
  startPos.value = {
    x: clientX - position.value.x,
    y: clientY - position.value.y,
  }
}

const drag = (clientX: number, clientY: number) => {
  if (!isDragging.value) return
  const newPosition = {
    x: clientX - startPos.value.x,
    y: clientY - startPos.value.y,
  }
  position.value = limitDrag(newPosition.x, newPosition.y)
}

const stopDrag = () => {
  isDragging.value = false
}

const stopPropagationIfScaled = (e: MouseEvent | TouchEvent) => {
  if (scale.value <= 1) return
  e.preventDefault()
  e.stopPropagation()
}

useEventListener(window, 'mousemove', (e: MouseEvent) => drag(e.clientX, e.clientY))
useEventListener(window, 'mouseup', stopDrag)
useEventListener(window, 'touchmove', (e: TouchEvent) => drag(e.touches[0].clientX, e.touches[0].clientY))
useEventListener(window, 'touchend', stopDrag)

const onMouseDown = (e: MouseEvent) => {
  stopPropagationIfScaled(e)
  startDrag(e.clientX, e.clientY)
}
const onTouchStart = (e: TouchEvent) => {
  stopPropagationIfScaled(e)
  startDrag(e.touches[0].clientX, e.touches[0].clientY)
}
</script>

<template>
  <div class="relative h-full w-full">
    <div
      ref="containerRef"
      class="h-full w-full overflow-hidden"
      :class="{
        'flex items-center justify-center': index >= props.srcs?.length,
      }"
      @mousedown="onMouseDown"
      @touchstart.prevent="onTouchStart"
    >
      <img
        v-if="index < props.srcs?.length"
        ref="imageRef"
        :src="props.srcs[index]"
        :alt="props?.alt || ''"
        :style="transformStyle"
        :class="{ '!object-contain': props.objectFit === 'contain' }"
        class="m-auto h-full max-h-full w-auto nc-attachment-image object-cover origin-center"
        loading="lazy"
        @error="onError"
      />
      <GeneralIcon v-else icon="ncFileTypeImage" class="flex-none w-6" />
    </div>

    <div v-if="controls" class="absolute mx-auto w-full bottom-4 flex items-center justify-center gap-2">
      <button
        class="rounded-full bg-gray-800/70 p-2 text-white hover:bg-gray-700/70 disabled:opacity-50"
        :disabled="scale >= MAX_SCALE"
        title="Zoom in"
        @click="zoom('in')"
      >
        <GeneralIcon icon="ncZoomIn" class="h-5 w-5" />
      </button>
      <button
        class="rounded-full bg-gray-800/70 p-2 text-white hover:bg-gray-700/70 disabled:opacity-50"
        :disabled="scale <= MIN_SCALE"
        title="Zoom out"
        @click="zoom('out')"
      >
        <GeneralIcon icon="ncZoomOut" class="h-5 w-5" />
      </button>
    </div>
  </div>
</template>

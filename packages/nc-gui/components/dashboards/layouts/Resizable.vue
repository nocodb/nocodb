<script lang="ts" setup>
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { ScreenDimensions } from 'nocodb-sdk'

const props = defineProps<{
  screenDimensions: ScreenDimensions
}>()

const emit = defineEmits<Emits>()

interface Emits {
  (event: 'update:screenDimensions', model: ScreenDimensions): void
}

const handle: Ref<HTMLElement | null> = ref(null)
const container: Ref<HTMLElement | null> = ref(null)

onMounted(() => {
  if (!container.value) return
  if (!props.screenDimensions || !props.screenDimensions.width || !props.screenDimensions.height) return
  container.value.style.width = `${props.screenDimensions.width}px`
  container.value.style.height = `${props.screenDimensions.height}px`
})

watch(
  () => props.screenDimensions,
  (newScreenDimensions, oldScreenDimensions) => {
    if (!container.value) return
    if (newScreenDimensions.width === oldScreenDimensions?.width && newScreenDimensions.height === oldScreenDimensions.height)
      return
    container.value.style.width = `${newScreenDimensions.width}px`
    container.value.style.height = `${newScreenDimensions.height}px`
  },
  { immediate: true },
)

function onMouseDown(event: MouseEvent) {
  if (!handle.value) return
  if (event.target !== handle.value) return

  const resizableElement = container.value!
  const startWidth = resizableElement.offsetWidth
  const startHeight = resizableElement.offsetHeight
  const startX = event.pageX
  const startY = event.pageY

  const onMouseMove = (moveEvent: MouseEvent) => {
    const newWidth = startWidth + (moveEvent.pageX - startX)
    const newHeight = startHeight + (moveEvent.pageY - startY)

    resizableElement.style.width = `${newWidth}px`
    resizableElement.style.height = `${newHeight}px`
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    emit('update:screenDimensions', {
      width: resizableElement.offsetWidth,
      height: resizableElement.offsetHeight,
    })
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div ref="container" class="resizable">
    <slot></slot>
    <div ref="handle" class="handle" @mousedown.stop="onMouseDown"></div>
  </div>
</template>

<style scoped>
.resizable {
  position: relative;
  display: inline-flex;
}

.handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: #ccc;
  cursor: nwse-resize;
}
</style>

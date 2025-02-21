<script setup lang="ts">
import type { PageDesignerWidgetType } from '../lib/widgets'

const props = defineProps<{
  icon: string
  text: string
  type: PageDesignerWidgetType
  first?: boolean
  last?: boolean
}>()

const dragging = ref(false)

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.type.toString())
  dragging.value = true
  setTimeout(() => {
    dragging.value = false
  }, 10)
}
</script>

<template>
  <div
    draggable="true"
    class="static-widget p-3 border-1 flex-1 border-nc-border-gray-medium flex flex-col justify-center items-center gap-2 cursor-pointer"
    :class="{ first, last, dragging }"
    @dragstart="onDragStart"
  >
    <img draggable="false" :src="icon" class="w-10 h-10" />
    <div class="text-center text-nc-content-gray text-[13px] font-700 leading-[18px]">{{ text }}</div>
  </div>
</template>

<style scoped lang="scss">
.static-widget {
  &.first {
    @apply rounded-[8px_0_0_8px] border-r-0;
  }
  &.last {
    @apply rounded-[0_8px_8px_0] border-l-0;
  }
  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }
  &.dragging {
    @apply border-none opacity-50 rounded-lg;
  }
}
</style>

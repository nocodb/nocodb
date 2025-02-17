<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'

const props = defineProps<{
  field: ColumnType
  icon: Component
  displayDragHandle?: boolean
}>()

const dragging = ref(false)

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', JSON.stringify(props.field))
  dragging.value = true
  setTimeout(() => {
    dragging.value = false
  }, 10)
}
</script>

<template>
  <div
    class="pl-1 pr-2 flex flex-row items-center hover:bg-gray-50 cursor-pointer"
    :class="{ dragging }"
    @dragstart="onDragStart"
  >
    <div class="flex flex-row items-center w-full truncate ml-1 py-[5px] pr-2">
      <component v-if="displayDragHandle" :is="iconMap.drag" class="!h-3.75 text-gray-600 mr-1 cursor-move" />
      <component :is="icon" class="!text-gray-600 mr-2" />

      <NcTooltip class="pl-1 truncate" show-on-truncate-only>
        <template #title>
          {{ field.title }}
        </template>
        <template #default>
          {{ field.title }}
        </template>
      </NcTooltip>
    </div>

    <div class="flex-1" />
    <slot name="suffixIcon"></slot>
  </div>
</template>

<style lang="scss" scoped>
.dragging {
  @apply w-[200px];
}
</style>

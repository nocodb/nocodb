<script setup lang="ts">
const props = defineProps<{
  field: Field
  icon: Component
}>()

const dragging = ref(false)

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', JSON.stringify(props.field))
  dragging.value = true
}
</script>

<template>
  <div
    draggable="true"
    class="pl-1 flex flex-row items-center hover:bg-gray-50"
    :class="{ dragging }"
    @dragend="dragging = false"
    @dragstart="onDragStart"
  >
    <div class="flex flex-row items-center w-full truncate ml-1 py-[5px] pr-2">
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
  </div>
</template>

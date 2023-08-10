<script lang="ts" setup>
import type { WidgetTemplate } from '#imports'
const props = defineProps<{
  item: WidgetTemplate
}>()

const { item } = toRefs(props)
const { addWidget } = useDashboardStore()
const dragStart = (ev: DragEvent, item: WidgetTemplate) => {
  ev.dataTransfer?.setData('text/plain', JSON.stringify(item))
}
</script>

<template>
  <button
    class="w-20 h-20 p-2 border-1 border-solid border-grey-100 rounded-lg text-sm text-grey cursor-pointer hover:bg-grey-lightest hover:border-grey"
    draggable="true"
    @click="addWidget(item.type)"
    @dragstart="dragStart($event, toRaw(item))"
  >
    <div class="flex items-center justify-center flex-col">
      <component :is="item.icon" class="text-grey" />
      <span>{{ item.title }}</span>
    </div>
  </button>
</template>

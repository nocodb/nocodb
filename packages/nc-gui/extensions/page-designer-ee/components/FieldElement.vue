<script setup lang="ts">
import { type ColumnType } from 'nocodb-sdk'
import { PageDesignerPayloadInj } from '../lib/context'
import { PageDesignerWidgetFactory } from '../lib/widgets'
import { isLinkedField } from '../lib/utils'

const props = defineProps<{
  field: ColumnType
  icon: Component
}>()

const payload = inject(PageDesignerPayloadInj)!

const dragging = ref(false)

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', JSON.stringify(props.field))
  dragging.value = true
  setTimeout(() => {
    dragging.value = false
  }, 10)
}

function onFieldClick() {
  if (isLinkedField(props.field)) {
    PageDesignerWidgetFactory.create(payload, PageDesignerWidgetFactory.createEmptyLinkedFieldWidget(props.field))
    return
  }
  PageDesignerWidgetFactory.create(payload, PageDesignerWidgetFactory.createEmptyFieldWidget(props.field))
}
</script>

<template>
  <div
    draggable="true"
    class="pl-1 flex flex-row items-center hover:bg-gray-50 cursor-pointer"
    :class="{ dragging }"
    @dragstart="onDragStart"
    @click="onFieldClick"
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

<style lang="scss" scoped>
.dragging {
  @apply w-[200px];
}
</style>

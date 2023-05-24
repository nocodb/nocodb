<script lang="ts" setup>
import type { DraggableEvent } from '@braks/revue-draggable'
import { useDraggable } from '@braks/revue-draggable'
import type { ScreenDimensions, ScreenPosition } from 'nocodb-sdk'
const props = defineProps<{
  screenPosition: ScreenPosition
  screenDimensions: ScreenDimensions
  hasFocus: boolean
}>()

const emit = defineEmits<Emits>()

const { screenPosition } = toRefs(props)

interface Emits {
  (event: 'remove'): void
  (event: 'setFocus'): void
  (event: 'updatePosition', data: { newPosition: ScreenPosition }): void
  (event: 'updateScreenDimensions', data: { newScreenDimensions: ScreenDimensions }): void
}

const nodeRef = ref<HTMLElement | null>(null)
const options = { defaultPosition: { x: screenPosition.value.x, y: screenPosition.value.y } }

const { onDragStop } = useDraggable(nodeRef, options)

onMounted(async () => {
  onDragStop((ev: DraggableEvent) => {
    emit('updatePosition', { newPosition: { x: ev.data.x, y: ev.data.y } })
  })
})

const onUpdateScreenDimensions = (newScreenDimensions: ScreenDimensions) => {
  emit('updateScreenDimensions', { newScreenDimensions })
}
</script>

<template>
  <div
    ref="nodeRef"
    class="box block absolute nc-dashboard-ui-element"
    :class="{ 'nc-dashboard-ui-element-has-focus': props.hasFocus }"
    @click.stop="emit('setFocus')"
  >
    <DashboardsLayoutsResizable :screen-dimensions="screenDimensions" @update:screen-dimensions="onUpdateScreenDimensions">
      <div class="nc-dashboard-ui-resizable-container">
        <slot />
        <MdiTrashCanCircleOutline class="text-lg mr-2" @click="emit('remove')" />
      </div>
    </DashboardsLayoutsResizable>
  </div>
</template>

<style>
.nc-dashboard-ui-resizable-card {
  width: 100%;
  height: 100%;
}
.nc-dashboard-ui-resizable-container {
  padding: 20px;
  /* background-color: #f9f9f9; */
  /* border: 1px solid #ccc; */
  height: 100%;
  width: 100%;
}

.nc-dashboard-ui-element-has-focus {
  /* border-color: #1890ff; */
  outline: 2px dotted rgb(119, 119, 221);
}
</style>

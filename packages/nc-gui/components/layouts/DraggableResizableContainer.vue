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
    class="box block absolute nc-layout-ui-element"
    :class="{ 'nc-layout-ui-element-has-focus': props.hasFocus }"
    @click.stop="emit('setFocus')"
  >
    <LayoutsResizable :screen-dimensions="screenDimensions" @update:screen-dimensions="onUpdateScreenDimensions">
      <div class="nc-layout-ui-resizable-container">
        <slot />
        <MdiTrashCanCircleOutline class="text-lg mr-2" @click="emit('remove')" />
      </div>
    </LayoutsResizable>
  </div>
</template>

<style>
.nc-layout-ui-resizable-card {
  width: 100%;
  height: 100%;
}
.nc-layout-ui-resizable-container {
  padding: 20px;
  height: 100%;
  width: 100%;
}

.nc-layout-ui-element-has-focus {
  /* outline: 2px dotted rgb(119, 119, 221); */
}
</style>

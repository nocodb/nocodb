<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import type { PageDesignerDividerWidget } from '../lib/widgets'
import { PageDesignerPayloadInj } from '../lib/context'

const props = defineProps<{
  id: string | number
}>()

const payload = inject(PageDesignerPayloadInj)!
const widget = ref() as Ref<PageDesignerDividerWidget>
watch(
  () => props.id,
  (id) => {
    widget.value = payload?.value?.widgets[id] as PageDesignerDividerWidget
  },
  { immediate: true },
)

const draggable = true
const throttleDrag = 1
const edgeDraggable = false
const startDragRotate = 0
const throttleDragRotate = 0
const scalable = false
const keepRatio = false
const throttleScale = 0
const snappable = true
const snapGridWidth = 1
const snapGridHeight = 1
const isDisplayGridGuidelines = false
const targetRef = ref<HTMLElement>()
const moveableRef = ref<Moveable>()
const rotationPosition = 'top'
const throttleRotate = 0

const resizable = true
const throttleResize = 1
const renderDirections = ['n', 'e', 'w', 's']
const onResize = (e: OnResize) => {
  e.target.style.width = `${e.width}px`
  e.target.style.height = `${e.height}px`
  e.target.style.transform = e.drag.transform
}

const onRotate = (e: OnRotate) => {
  e.target.style.transform = e.drag.transform
  const angle = Math.round(+([...e.drag.transform.matchAll(/rotate\((.*?)deg\)/g)]?.[0]?.[1] ?? 0))
  widget.value.angle = isNaN(angle) ? 0 : angle
}
const onDrag = (e: OnDrag) => {
  e.target.style.transform = e.transform
}
const onScale = (e: OnScale) => {
  e.target.style.transform = e.drag.transform
}
const onRenderEnd = () => {
  widget.value.cssStyle = targetRef.value?.getAttribute('style') ?? ''
}

watch(
  () => widget.value.angle,
  () => {
    nextTick(() => {
      moveableRef.value?.updateRect()
    })
  },
)

const container = useParentElement()
</script>

<template>
  <div v-if="widget">
    <div ref="targetRef" class="absolute" :style="widget.cssStyle.replace(/rotate\(.*?\)/, `rotate(${widget.angle || 0}deg)`)">
      <div
        :style="{
          background: `${widget.backgroundColor}`,
          height: '100%',
          width: '100%',
        }"
      ></div>
    </div>
    <Moveable
      ref="moveableRef"
      :rotatable="true"
      :throttle-rotate="throttleRotate"
      :rotation-position="rotationPosition"
      :target="targetRef"
      :draggable="draggable"
      :throttle-drag="throttleDrag"
      :edge-draggable="edgeDraggable"
      :start-drag-rotate="startDragRotate"
      :throttle-drag-rotate="throttleDragRotate"
      :scalable="scalable"
      :keep-ratio="keepRatio"
      :throttle-scale="throttleScale"
      :snappable="snappable"
      :snap-grid-width="snapGridWidth"
      :snap-grid-height="snapGridHeight"
      :is-display-grid-guidelines="isDisplayGridGuidelines"
      :resizable="resizable"
      :throttle-resize="throttleResize"
      :render-directions="renderDirections"
      :origin="false"
      :container="container"
      class-name="nc-moveable"
      @render-end="onRenderEnd"
      @resize="onResize"
      @rotate="onRotate"
      @drag="onDrag"
      @scale="onScale"
    />
  </div>
</template>

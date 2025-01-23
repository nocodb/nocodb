<script setup lang="ts">
import Moveable from 'vue3-moveable'
import { ref } from 'vue'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import type { PageDesignerTextWidget } from '../lib/widgets'
import { PageDesignerPayloadInj } from '../lib/context'

const props = defineProps<{
  index: number
}>()

const payload = inject(PageDesignerPayloadInj)!
const active = computed(() => payload.value.currentWidgetIndex === props.index)
const widget = ref(payload?.value?.widgets[props.index] as PageDesignerTextWidget)
watch(
  () => props.index,
  (idx) => {
    widget.value = payload?.value?.widgets[idx] as PageDesignerTextWidget
  },
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
const snapGridWidth = 10
const snapGridHeight = 10
const isDisplayGridGuidelines = false
const targetRef = ref<HTMLElement>()
const moveableRef = ref(null)
const rotationPosition = 'top'
const throttleRotate = 0

const resizable = true
const throttleResize = 1
const renderDirections = ['se']
const onResize = (e: OnResize) => {
  e.target.style.width = `${e.width}px`
  e.target.style.height = `${e.height}px`
  e.target.style.transform = e.drag.transform
}

const onRotate = (e: OnRotate) => {
  e.target.style.transform = e.drag.transform
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

const container = useParentElement()
</script>

<template>
  <div ref="targetRef" class="absolute" :style="widget.cssStyle" v-bind="$attrs">
    <div
      :style="{
        display: 'flex',
        background: `${widget.backgroundColor}`,
        height: '100%',
        width: '100%',
        borderWidth: `${widget.borderTop || 0}px ${widget.borderRight || 0}px ${widget.borderBottom || 0}px ${
          widget.borderLeft || 0
        }px`,
        borderColor: widget.borderColor,
        borderRadius: `${widget.borderRadius || 0}px`,
        justifyContent: widget.horizontalAlign,
        alignItems: widget.verticalAlign,
      }"
    >
      <span
        v-if="widget.value"
        :style="{
          fontSize: `${widget.fontSize}px`,
          fontWeight: widget.fontWeight,
          fontFamily: widget.fontFamily,
          lineHeight: widget.lineHeight,
          color: widget.textColor,
        }"
      >
        {{ widget.value }}
      </span>
      <span v-else class="text-nc-content-gray-muted">Lorem ipsum...</span>
    </div>
  </div>
  <Moveable
    ref="moveableRef"
    :rotatable="false"
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
    :data-inactive-widget="!active"
    :container="container"
    @resize="onResize"
    @rotate="onRotate"
    @drag="onDrag"
    @scale="onScale"
    @render-end="onRenderEnd"
  />
</template>

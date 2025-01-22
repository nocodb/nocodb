<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import type { PageDesignerImageWidget } from '../../src/widgets'

defineProps<{
  widget: PageDesignerImageWidget
  active: boolean
}>()

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
const targetRef = ref(null)
const moveableRef = ref(null)
const rotationPosition = 'top'
const throttleRotate = 0

const maxWidth = 'auto'
const maxHeight = 'auto'
const minWidth = 'auto'
const minHeight = 'auto'
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
</script>

<template>
  <div
    ref="targetRef"
    class="target"
    :style="`width: 100px; height: 50px; transform: translate(0, 0); max-width: ${maxWidth};max-height: ${maxHeight};min-width: ${minWidth};min-height: ${minHeight};`"
  >
    <div
      :style="{
        background: `${widget.backgroundColor}`,
        height: '100%',
        width: '100%',
        borderWidth: `${widget.borderTop || 0}px ${widget.borderRight || 0}px ${widget.borderBottom || 0}px ${
          widget.borderLeft || 0
        }px`,
        borderColor: widget.borderColor,
        borderRadius: `${widget.borderRadius || 0}px`,
      }"
    >
      <img
        :src="widget.imageSrc"
        class="w-full h-full"
        :style="{
          objectFit: widget.objectFit || 'fill',
        }"
      />
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
    @resize="onResize"
    @rotate="onRotate"
    @drag="onDrag"
    @scale="onScale"
  />
</template>

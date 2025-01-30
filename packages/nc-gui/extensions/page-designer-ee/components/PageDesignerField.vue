<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import { isVirtualCol } from 'nocodb-sdk'
import type { PageDesignerFieldWidget, PageDesignerWidgetComponentProps } from '../lib/widgets'
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'

const props = defineProps<PageDesignerWidgetComponentProps>()
const payload = inject(PageDesignerPayloadInj)!
const widget = ref() as Ref<PageDesignerFieldWidget>
const row = inject(PageDesignerRowInj)!
watch(
  () => props.id,
  (id) => {
    widget.value = payload?.value?.widgets[id] as PageDesignerFieldWidget
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
  <div v-if="widget && !isRowEmpty(row, widget.field)">
    <div ref="targetRef" class="absolute" :style="widget.cssStyle">
      <div
        :style="{
          height: '100%',
          width: '100%',
          borderWidth: `${widget.borderTop || 0}px ${widget.borderRight || 0}px ${widget.borderBottom || 0}px ${
            widget.borderLeft || 0
          }px`,
          borderColor: widget.borderColor,
          borderRadius: `${widget.borderRadius || 0}px`,
          background: widget.backgroundColor,
        }"
      >
        <SmartsheetRow v-if="row" :row="row">
          <SmartsheetVirtualCell
            v-if="isVirtualCol(widget.field)"
            :column="widget.field"
            :model-value="row.row?.[widget.field.title]"
            read-only
            :edit-enabled="false"
          />
          <SmartsheetCell
            v-else
            :column="widget.field"
            :model-value="row.row?.[widget.field.title]"
            read-only
            :edit-enabled="false"
          />
        </SmartsheetRow>
        <span v-else class="text-nc-content-gray-muted">{{ widget.field.title }}</span>
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

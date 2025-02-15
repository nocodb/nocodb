<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import type { ColumnType } from 'nocodb-sdk'
import {
  LinkedFieldDisplayAs,
  type PageDesignerLinkedFieldWidget,
  type PageDesignerWidgetComponentProps,
  horizontalAlignTotextAlignMap,
} from '../lib/widgets'
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'
import { Removable } from '../lib/removable'

const props = defineProps<PageDesignerWidgetComponentProps>()
defineEmits(['deleteCurrentWidget'])

const payload = inject(PageDesignerPayloadInj)!
const widget = ref() as Ref<PageDesignerLinkedFieldWidget>
const row = inject(PageDesignerRowInj)! as Ref<Row>
watch(
  () => props.id,
  (id) => {
    widget.value = payload?.value?.widgets[id] as PageDesignerLinkedFieldWidget
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

const fieldTitle = computed(() => widget.value.field.title ?? '')

const column = computed(() => widget.value!.field as Required<ColumnType>)

const isNew = ref(false)

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, unlink } = useProvideLTARStore(column, row, isNew)

const inlineValue = computed(() => {
  if (widget.value.displayAs !== LinkedFieldDisplayAs.INLINE) return ''
  return (
    row.value.row[widget.value.field.title ?? '']
      ?.map((relatedRow: Record<string, any>) => relatedRow[relatedTableDisplayValueProp.value] ?? '')
      .filter(Boolean)
      .join(', ') ?? ''
  )
})
</script>

<template>
  <div v-if="widget && !isRowEmpty(row!, widget.field)" class="field-widget">
    <div ref="targetRef" class="absolute" :style="widget.cssStyle">
      <div
        :style="{
          display: 'flex',
          height: '100%',
          width: '100%',
          borderWidth: `${widget.borderTop || 0}px ${widget.borderRight || 0}px ${widget.borderBottom || 0}px ${
            widget.borderLeft || 0
          }px`,
          borderColor: widget.borderColor,
          borderRadius: `${widget.borderRadius || 0}px`,
          background: widget.backgroundColor,
          fontSize: `${widget.fontSize}px`,
          fontWeight: widget.fontWeight,
          fontFamily: widget.fontFamily,
          lineHeight: widget.lineHeight,
          color: widget.textColor,
          justifyContent: widget.horizontalAlign,
          alignItems: widget.verticalAlign,
          textAlign: horizontalAlignTotextAlignMap[widget.horizontalAlign],
          overflow: 'hidden',
        }"
        class="px-2 py-1"
      >
        <template v-if="row">
          <ul v-if="widget.displayAs === LinkedFieldDisplayAs.LIST" class="list-disc list-inside">
            <li v-for="value in row.row[widget.field.title ?? '']">
              {{ value[relatedTableDisplayValueProp] }}
            </li>
          </ul>
          <span v-else-if="widget.displayAs === LinkedFieldDisplayAs.INLINE">
            {{ inlineValue }}
          </span>
        </template>
        <span v-else class="text-nc-content-gray-muted print-hide">{{ fieldTitle }}</span>
      </div>
    </div>
    <Moveable
      ref="moveableRef"
      :ables="[Removable]"
      :props="{ removable: true, deleteWidget: () => $emit('deleteCurrentWidget') }"
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

<style lang="scss" scoped>
.field-widget {
  :deep(.plain-cell) {
    font-family: inherit;
  }
}
</style>

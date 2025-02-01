<script setup lang="ts">
import Moveable from 'vue3-moveable'
import { ref } from 'vue'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { type ColumnType, UITypes, dateFormats, roundUpToPrecision, timeFormats } from 'nocodb-sdk'
import dayjs from 'dayjs'
import type { PageDesignerTextWidget, PageDesignerWidgetComponentProps } from '../lib/widgets'
import { PageDesignerPayloadInj, PageDesignerRowInj, PageDesignerTableTypeInj } from '../lib/context'
import { Removable } from '../lib/removable'

const props = defineProps<PageDesignerWidgetComponentProps>()
defineEmits(['deleteCurrentWidget'])

const payload = inject(PageDesignerPayloadInj)!
const meta = inject(PageDesignerTableTypeInj)
const widget = ref() as Ref<PageDesignerTextWidget>
watch(
  () => props.id,
  (id) => {
    widget.value = payload?.value?.widgets[id] as PageDesignerTextWidget
  },
  { immediate: true },
)

const columnByTitle = computed(() => {
  if (!meta?.value) return {}
  return (meta.value.columns ?? []).reduce((map, cur) => {
    map[cur?.title ?? ''] = cur
    return map
  }, {} as Record<string, ColumnType>)
})

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

const row = inject(PageDesignerRowInj)!

const unsupportedTypes = [
  UITypes.Attachment,
  UITypes.JSON,
  UITypes.LinkToAnotherRecord,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Links,
  UITypes.Button,
  UITypes.CreatedBy,
]

const dateTimeTypes = [UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.LastModifiedBy]
const timeTypes = [UITypes.Time]

const getDateTimeFormat = (colMeta: any) => {
  const dateFormat = colMeta?.date_format ?? dateFormats[0]
  const timeFormat = colMeta?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
}

const getDecimal = (value: any, colMeta: any) => {
  if (value === null) return null

  if (isNaN(Number(value))) return null

  if (colMeta.isLocaleString) {
    return Number(roundUpToPrecision(Number(value), colMeta.precision ?? 1)).toLocaleString(undefined, {
      minimumFractionDigits: colMeta.precision ?? 1,
      maximumFractionDigits: colMeta.precision ?? 1,
    })
  }

  return roundUpToPrecision(Number(value), colMeta.precision ?? 1)
}

function getTextualRepresentationForColumn(column: string, record: Record<string, unknown>) {
  const raw = `{${column}}`
  const colType = columnByTitle.value[column]
  if (!colType) return raw

  const colMeta = parseProp(colType.meta)
  const uidt = colType.uidt as UITypes
  const value = record[column]
  const isRichTextLongText = uidt === UITypes.LongText && colMeta.richMode
  if (isRichTextLongText || unsupportedTypes.includes(uidt)) return raw
  else if (uidt === UITypes.Currency) {
    return new Intl.NumberFormat(colMeta.currency_locale || 'en-US', {
      style: 'currency',
      currency: colMeta.currency_code || 'USD',
    }).format(value as number)
  } else if (uidt === UITypes.Checkbox) return !!value
  else if (uidt === UITypes.Percent) return value && !isNaN(Number(value)) ? `${value}%` : value ?? raw
  else if (dateTimeTypes.includes(uidt)) {
    const dateObj = dayjs(value as string)
    if (!dateObj.isValid()) return raw
    return dateObj.utc().local().format(getDateTimeFormat(colMeta))
  } else if (timeTypes.includes(uidt)) {
    const dateObj = dayjs(value as string)
    if (!dateObj.isValid()) return raw
    return dateObj.format(colMeta.is12hrFormat ? 'hh:mm A' : 'HH:mm')
  } else if (uidt === UITypes.Duration) {
    return convertMS2Duration(value, colMeta?.duration || 0) ?? raw
  } else if (uidt === UITypes.Decimal) {
    return getDecimal(value, colMeta) ?? raw
  } else if (Array.isArray(value)) return value.join(', ')
  else if (typeof value === 'object' || value == null) return raw
  return value
}

const replacedText = computed(() => {
  const record = (row.value?.row ?? {}) as Record<string, any>
  return widget.value.value.replace(/{(.*?)}/g, (_, key) => {
    if (key in record) return getTextualRepresentationForColumn(key, record)
    return `{${key}}`
  })
})

function focusTextarea() {
  const textarea = document.querySelector<HTMLTextAreaElement>('#textWidgetContent')
  nextTick(() => {
    textarea?.dispatchEvent(new Event('focusPromptWithFields'))
  })
}

onMounted(focusTextarea)
</script>

<template>
  <div v-if="widget" @click="focusTextarea">
    <div ref="targetRef" class="absolute" :style="widget.cssStyle">
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
        class="px-2 py-1"
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
          {{ replacedText }}
        </span>
        <span v-else class="print-hide text-nc-content-gray-muted">Lorem ipsum...</span>
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
      @resize="onResize"
      @rotate="onRotate"
      @drag="onDrag"
      @scale="onScale"
      @render-end="onRenderEnd"
    />
  </div>
</template>

<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import { isLinksOrLTAR, isSystemColumn, type ColumnType } from 'nocodb-sdk'
import {
  LinkedFieldDisplayAs,
  LinkedFieldListType,
  type PageDesignerLinkedFieldWidget,
  type PageDesignerWidgetComponentProps,
  horizontalAlignTotextAlignMap,
} from '../lib/widgets'
import { PageDesignerPayloadInj, PageDesignerRowInj } from '../lib/context'
import { Removable } from '../lib/removable'
import PlainCell from '../../../components/smartsheet/PlainCell.vue'

const props = defineProps<PageDesignerWidgetComponentProps>()
defineEmits(['deleteCurrentWidget'])

const runtimeConfig = useRuntimeConfig()

const payload = inject(PageDesignerPayloadInj)!
const widget = ref() as Ref<PageDesignerLinkedFieldWidget>
const row = inject(PageDesignerRowInj)! as Ref<Row>

const relatedRows = ref<Record<string, any>[]>([])

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

const { relatedTableMeta, loadRelatedTableMeta, relatedTableDisplayValueProp, unlink, loadChildrenList } = useProvideLTARStore(
  column,
  row,
  isNew,
)

const inlineValue = computed(() => {
  if (widget.value.displayAs !== LinkedFieldDisplayAs.INLINE) return ''
  return (
    relatedRows.value
      ?.map((relatedRow: Record<string, any>) => relatedRow[relatedTableDisplayValueProp.value] ?? '')
      .filter(Boolean)
      .join(', ') ?? ''
  )
})

const isNumberedList = computed(() => widget.value.listType === LinkedFieldListType.Number)
const isTable = computed(() => widget.value.displayAs === LinkedFieldDisplayAs.TABLE)
const columns = computed(() => relatedTableMeta.value.columns ?? [])
const columnsMapById = computed(() =>
  columns.value.reduce((map, col) => {
    map[col.id!] = col
    return map
  }, {} as Record<string, Record<string, any>>),
)

const tableColumns = computed(() => widget.value.tableColumns.map((colId) => columnsMapById.value[colId]!).filter(Boolean))
async function loadRelatedRows() {
  if (!row.value) return
  relatedRows.value = (await loadChildrenList(undefined, undefined, runtimeConfig.public.maxPageDesignerTableRows))?.list ?? []
}

onMounted(loadRelatedRows)
watch(row, loadRelatedRows)
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
        :class="{ 'px-2 py-1': !isTable }"
      >
        <template v-if="row">
          <component
            :is="isNumberedList ? 'ol' : 'ul'"
            v-if="widget.displayAs === LinkedFieldDisplayAs.LIST"
            :class="['list-inside m-0 p-0', isNumberedList ? 'list-decimal' : 'list-disc']"
          >
            <li v-for="row in relatedRows">
              <span :class="{ 'relative left-[-8px]': !isNumberedList }">
                {{ row[relatedTableDisplayValueProp] }}
              </span>
            </li>
          </component>
          <span v-else-if="widget.displayAs === LinkedFieldDisplayAs.INLINE">
            {{ inlineValue }}
          </span>
          <table v-else class="w-full">
            <thead>
              <tr>
                <th v-for="column in tableColumns" :key="column.id">
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in relatedRows" :key="row.Id">
                <td v-for="column in tableColumns" :key="column.id">
                  <PlainCell :column="column" :model-value="row[column?.title ?? '']" />
                </td>
              </tr>
            </tbody>
          </table>
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
table,
th,
td {
  @apply border-1 border-nc-border-gray-dark;
}
table {
  border-collapse: collapse;
}
th,
td {
  padding: 6px 12px;
  font-size: 12px;
}
th {
  @apply text-nc-content-gray;
  font-weight: 700;
}
td {
  @apply text-nc-content-gray-subtle2;
  font-weight: 500;
}
</style>

<script setup lang="ts">
import Moveable from 'vue3-moveable'
import type { OnDrag, OnResize, OnRotate, OnScale } from 'vue3-moveable'
import { ref } from 'vue'
import { type ColumnType } from 'nocodb-sdk'
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

const defaultBlackColor = '#000000'

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
const onRender = () => {
  widget.value.cssStyle = targetRef.value?.getAttribute('style') ?? ''
}

const container = useParentElement()

const fieldTitle = computed(() => widget.value.field.title ?? '')

const column = computed(() => widget.value!.field as Required<ColumnType>)

const isNew = ref(false)

const { relatedTableMeta, relatedTableDisplayValueProp, loadChildrenList } = useProvideLTARStore(column, row, isNew)

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
const snapGridWidth = computed(() => (isTable.value ? 10 : 1))
const snapGridHeight = computed(() => (isTable.value ? 10 : 1))
const columns = computed(() => relatedTableMeta.value.columns ?? [])
const columnsMapById = computed(() =>
  columns.value.reduce((map, col) => {
    map[col.id!] = col
    return map
  }, {} as Record<string, Record<string, any>>),
)

const tableColumns = computed(() =>
  widget.value.tableColumns
    .filter((col) => col.selected)
    .map((col) => columnsMapById.value[col.id]!)
    .filter(Boolean),
)
async function loadRelatedRows() {
  if (!row.value || !row.value.row[column.value.title]) return
  relatedRows.value = (await loadChildrenList(undefined, undefined, runtimeConfig.public.maxPageDesignerTableRows))?.list ?? []
}

onMounted(loadRelatedRows)
watch(row, loadRelatedRows)

const borderProps = computed(() => {
  return {
    borderWidth: `${widget.value.borderTop || 0}px ${widget.value.borderRight || 0}px ${widget.value.borderBottom || 0}px ${
      widget.value.borderLeft || 0
    }px`,
    borderColor: widget.value.borderColor,
    borderRadius: `${widget.value.borderRadius || 0}px`,
  }
})

const tableRowHeight = computed(() => {
  const height = +(widget.value.cssStyle.match(/height:\s*(\d+)px/)?.[1] ?? 0)
  return (height - +widget.value.borderTop - +widget.value.borderBottom) / ((relatedRows.value ?? []).length + 1)
})

const { getPossibleAttachmentSrc } = useAttachment()

const attachmentUrl = (value: Record<string, any>) => getPossibleAttachmentSrc(value?.[0])?.[0]
</script>

<template>
  <div v-if="widget && !isRowEmpty(row!, widget.field) && row.row[column.title]" class="field-widget">
    <div ref="targetRef" class="absolute" :style="widget.cssStyle">
      <div
        :style="{
          display: 'flex',
          height: '100%',
          width: '100%',
          ...(isTable ? {} : borderProps),
          background: widget.backgroundColor,
          fontSize: `${widget.fontSize}px`,
          fontWeight: widget.fontWeight,
          fontFamily: widget.fontFamily,
          lineHeight: widget.lineHeight,
          color: widget.textColor,
          justifyContent: widget.horizontalAlign,
          alignItems: widget.verticalAlign,
          textAlign: horizontalAlignTotextAlignMap[widget.horizontalAlign],
        }"
        :class="{ 'px-2 py-1 overflow-hidden': !isTable }"
      >
        <template v-if="row">
          <component
            :is="isNumberedList ? 'ol' : 'ul'"
            v-if="widget.displayAs === LinkedFieldDisplayAs.LIST"
            class="list-inside m-0 p-0"
            :class="[isNumberedList ? 'list-decimal' : 'list-disc']"
          >
            <li v-for="relatedRow in relatedRows" :key="relatedRow.Id">
              <span :class="{ 'relative left-[-8px]': !isNumberedList }" :style="{ fontFamily: widget.fontFamily }">
                {{ relatedRow[relatedTableDisplayValueProp] }}
              </span>
            </li>
          </component>
          <span v-else-if="widget.displayAs === LinkedFieldDisplayAs.INLINE" :style="{ fontFamily: widget.fontFamily }">
            {{ inlineValue }}
          </span>
          <table
            v-else
            class="w-full"
            :class="[
              {
                'default-text-color': widget.textColor === defaultBlackColor,
                'default-border-color': widget.borderColor === defaultBlackColor,
              },
            ]"
            :style="{
              ...borderProps,
            }"
          >
            <thead>
              <tr>
                <th
                  v-for="relatedColumn in tableColumns"
                  :key="relatedColumn.id"
                  :style="{
                    ...(widget.borderColor === defaultBlackColor ? {} : { borderColor: widget.borderColor }),
                    color: widget.tableFontSettings.header.textColor,
                    fontSize: `${widget.tableFontSettings.header.fontSize}px`,
                    lineHeight: widget.tableFontSettings.header.lineHeight,
                    fontWeight: widget.tableFontSettings.header.fontWeight,
                    fontFamily: widget.fontFamily,
                    height: `${tableRowHeight}px`,
                  }"
                >
                  {{ relatedColumn.title }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="relatedRow in relatedRows" :key="relatedRow.Id">
                <td
                  v-for="relatedColumn in tableColumns"
                  :key="relatedColumn.id"
                  :style="{
                    ...(widget.borderColor === defaultBlackColor ? {} : { borderColor: widget.borderColor }),
                    color: widget.tableFontSettings.row.textColor,
                    fontSize: `${widget.tableFontSettings.row.fontSize}px`,
                    lineHeight: widget.tableFontSettings.row.lineHeight,
                    fontWeight: widget.tableFontSettings.row.fontWeight,
                    fontFamily: widget.fontFamily,
                    height: `${tableRowHeight}px`,
                  }"
                >
                  <img
                    v-if="attachmentUrl(relatedRow[relatedColumn?.title ?? ''])"
                    :src="attachmentUrl(relatedRow[relatedColumn?.title ?? ''])"
                    class="h-full w-auto object-contain"
                  />
                  <PlainCell v-else :column="relatedColumn" :model-value="relatedRow[relatedColumn?.title ?? '']" />
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
      @render="onRender"
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

th,
td {
  @apply border-b-1 border-r border-nc-border-gray-dark;
  &:last-child {
    border-right: 0;
  }
}
tr:last-child {
  td {
    border-bottom: 0;
  }
}

table {
  border-collapse: separate;
  border-spacing: 0;
}
th,
td {
  padding: 6px 12px;
  font-size: 12px;
}
th {
  font-weight: 700;
}
td {
  font-weight: 500;
}
table.default-text-color {
  th {
    @apply text-nc-content-gray;
  }
  td {
    @apply text-nc-content-gray-subtle2;
  }
}
table.default-border-color {
  @apply !border-nc-border-gray-dark;
}
</style>

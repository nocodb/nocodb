<script setup lang="ts">
import { type ColumnType, type TableType, type ViewType } from 'nocodb-sdk'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { useCanvasTable } from './composables/useCanvasTable'
import type { Row } from '~/lib/types'

const props = defineProps<{
  totalRows: number
  data: Map<number, Row>
  rowHeightEnum?: number
  loadData: (params?: any, shouldShowLoading?: boolean) => Promise<Array<Row>>
  callAddEmptyRow?: (addAfter?: number) => Row | undefined
  deleteRow?: (rowIndex: number, undo?: boolean) => Promise<void>
  updateOrSaveRow?: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
  ) => Promise<any>
  deleteSelectedRows?: () => Promise<void>
  clearInvalidRows?: () => void
  deleteRangeOfRows?: (cellRange: CellRange) => Promise<void>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  bulkUpdateRows?: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
  ) => Promise<void>
  bulkDeleteAll?: () => Promise<void>
  bulkUpsertRows?: (
    insertRows: Row[],
    updateRows: [],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
  ) => Promise<void>
  expandForm?: (row: Row, state?: Record<string, any>, fromToolbar?: boolean) => void
  removeRowIfNew?: (row: Row) => void
  rowSortRequiredRows: Row[]
  applySorting?: (newRows?: Row | Row[]) => void
  clearCache: (visibleStartIndex: number, visibleEndIndex: number) => void
  syncCount: () => Promise<void>
  selectedRows: Array<Row>
  chunkStates: Array<'loading' | 'loaded' | undefined>
  isBulkOperationInProgress: boolean
  selectedAllRecords?: boolean
}>()

const emits = defineEmits(['bulkUpdateDlg', 'update:selectedAllRecords'])

const {
  loadData,
  callAddEmptyRow,
  updateOrSaveRow,
  deleteRow,
  expandForm,
  clearCache,
  syncCount,
  bulkUpdateRows,
  bulkUpsertRows,
  deleteRangeOfRows,
  removeRowIfNew,
  clearInvalidRows,
  updateRecordOrder,
  applySorting,
  bulkDeleteAll,
} = props

// Props to Refs
const totalRows = toRef(props, 'totalRows')
const chunkStates = toRef(props, 'chunkStates')
const cachedRows = toRef(props, 'data')

// Refs
const containerRef = ref()
const wrapperRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)

// Composables
const { height, width } = useElementSize(wrapperRef)

const {
  rowSlice,
  colSlice,
  editEnabled,
  activeCell,
  totalWidth,
  columnWidths,
  rowHeight,
  updateVisibleRows,
  columns,
  findColumnIndex,
  canvasRef,
  triggerRefreshCanvas,
  resizeableColumn,
  resizeMouseMove,
  isDragging,
  startDrag,
  startResize,
} = useCanvasTable({
  rowHeightEnum: props.rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
  scrollLeft,
  width,
  height,
})

const { metaColumnById } = useViewColumnsOrThrow()

// Computed
const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * rowHeight.value
  const headerHeight = 32
  return rowsHeight + headerHeight + 256
})

const COLUMN_BUFFER_SIZE = 5

const calculateSlices = () => {
  if (!containerRef.value?.clientWidth || !containerRef.value?.clientHeight) {
    setTimeout(calculateSlices, 50)
    return
  }
  const startRowIndex = Math.max(0, Math.floor(scrollTop.value / rowHeight.value))
  const visibleRowCount = Math.ceil(containerRef.value.clientHeight / rowHeight.value)
  const endRowIndex = Math.min(startRowIndex + visibleRowCount, totalRows.value)
  const newEndRow = Math.min(totalRows.value, Math.max(endRowIndex, startRowIndex + 50))

  const startColIndex = Math.max(0, findColumnIndex(scrollLeft.value))
  const endColIndex = Math.min(
    columnWidths.value.length,
    findColumnIndex(scrollLeft.value + containerRef.value.clientWidth + COLUMN_BUFFER_SIZE) + 1,
  )

  if (startRowIndex !== rowSlice.value.start || newEndRow !== rowSlice.value.end) {
    rowSlice.value = { start: startRowIndex, end: newEndRow }
  }

  if (startColIndex !== colSlice.value.start || endColIndex !== colSlice.value.end) {
    colSlice.value = { start: startColIndex, end: endColIndex }
  }

  updateVisibleRows()
}

function handleMouseClick(e: MouseEvent) {
  editEnabled.value = null
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top - 32
  const rowIndex = Math.floor(y / rowHeight.value) + rowSlice.value.start

  if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
    activeCell.value = { row: -1, column: -1 }
    triggerRefreshCanvas()
    return
  }

  const x = e.clientX - rect.left
  let clickedColumn = null

  const fixedCols = columns.value.filter((col) => col.fixed)
  let xOffset = 0

  for (const column of fixedCols) {
    const width = columnWidths.value[columns.value.indexOf(column)] ?? 10
    if (x >= xOffset && x < xOffset + width) {
      if (!column.uidt) continue
      clickedColumn = column
      break
    }
    xOffset += width
  }

  if (!clickedColumn) {
    const visibleStart = colSlice.value.start
    const visibleEnd = colSlice.value.end

    const startOffset = columnWidths.value.slice(0, visibleStart).reduce((sum, width) => sum + width, 0)

    xOffset = startOffset - scrollLeft.value

    for (let i = visibleStart; i < visibleEnd; i++) {
      const width = columnWidths.value[i] ?? 10
      if (x >= xOffset && x < xOffset + width) {
        clickedColumn = columns.value[i]
        break
      }
      xOffset += width
    }
  }

  if (clickedColumn) {
    activeCell.value = {
      row: rowIndex,
      column: columns.value.findIndex((col) => col.id === clickedColumn.id),
    }

    if (e.detail === 2) {
      editEnabled.value = {
        rowIndex,
        x: xOffset + scrollLeft.value,
        y: (rowIndex + 1) * rowHeight.value + 32,
        column: metaColumnById.value[clickedColumn.id],
        row: cachedRows.value.get(rowIndex),
        height: rowHeight.value,
        width: parseInt(clickedColumn.width, 10),
      }
    }
    triggerRefreshCanvas()
  }
}

let rafnId: number | null = null

useScroll(containerRef, {
  behavior: 'instant',
  onScroll: (e) => {
    if (rafnId) cancelAnimationFrame(rafnId)

    rafnId = requestAnimationFrame(() => {
      scrollTop.value = e.target.scrollTop
      scrollLeft.value = e.target.scrollLeft
      calculateSlices()
      triggerRefreshCanvas()
    })
  },
})
onMounted(async () => {
  await syncCount()
  calculateSlices()
  triggerRefreshCanvas()
})

const handleMouseDown = (e: MouseEvent) => {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top

  if (y <= 32) {
    // Try resize first
    startResize(e)

    // If not resizing, try drag
    if (!resizeableColumn.value) {
      startDrag(e.clientX - rect.left)
    }
  }
}

// Handle both resize and drag move events
const handleMouseMove = (e: MouseEvent) => {
  resizeMouseMove(e)
}
</script>

<template>
  <div ref="wrapperRef" class="w-full h-full">
    <div ref="containerRef" class="relative w-full h-full overflow-auto border border-gray-200">
      <div
        class="relative"
        :style="{
          height: `${totalHeight}px`,
          width: `${totalWidth}px`,
        }"
      >
        <canvas
          ref="canvasRef"
          class="sticky top-0 left-0"
          :height="`${height}px`"
          :width="`${width}px`"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @click="handleMouseClick"
        >
        </canvas>
      </div>
      <div
        v-if="editEnabled"
        :style="{
          top: `${rowHeight * editEnabled.rowIndex + 32}px`,
          left: `${editEnabled.x}px`,
          width: `${editEnabled.width}px`,
          height: `${editEnabled.height}`,
          borderRadius: '2px',
        }"
        class="absolute bg-white border border-2 border-[#3366ff] pointer-events-none"
      >
        <LazySmartsheetRow :row="editEnabled.row">
          <template #default="{ state }">
            <SmartsheetCell
              v-model="editEnabled.row.row[editEnabled.column.title]"
              :column="editEnabled.column"
              :row-index="editEnabled.rowIndex"
              active
              edit-enabled
              @save="updateOrSaveRow?.(editEnabled.row, editEnabled.column.title, state)"
            />
          </template>
        </LazySmartsheetRow>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

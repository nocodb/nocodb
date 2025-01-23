<script setup lang="ts">
import { type ColumnType, type TableType, UITypes, type ViewType } from 'nocodb-sdk'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { normalizeWidth, useColumnResize } from './composables/useColumnResize'
import { useCellRenderer } from './cells'
import { roundedRect, truncateText } from './utils/canvas'
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
const canvasRef = ref()
const containerRef = ref()
const wrapperRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)

// Composables
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
} = useCanvasTable({
  rowHeightEnum: props.rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
})
const { updateGridViewColumn, metaColumnById } = useViewColumnsOrThrow()
const { height, width } = useElementSize(wrapperRef)
const { renderCell } = useCellRenderer()

// Computed

const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * rowHeight.value
  const headerHeight = 32
  return rowsHeight + headerHeight + 256
})

const { handleMouseMove, handleMouseDown, cleanupResize } = useColumnResize(
  canvasRef,
  columns,
  colSlice,
  scrollLeft,
  (columnId, newWidth) => {
    const columnIndex = columns.value.findIndex((col) => col.id === columnId)
    if (columnIndex !== -1) {
      try {
        const normalizedWidth = normalizeWidth(metaColumnById.value[columnId], newWidth)
        columns.value[columnIndex].width = `${normalizedWidth}px`
        requestAnimationFrame(drawCanvas)
      } catch (error) {
        console.error('Error updating column width:', error)
        cleanupResize()
      }
    }
  },
  (columnId, width) => {
    const columnIndex = columns.value.findIndex((col) => col.id === columnId)

    if (columnIndex === -1) return

    const normalizedWidth = normalizeWidth(metaColumnById.value[columnId], width)
    updateGridViewColumn(columnId, { width: `${normalizedWidth}px` })

    nextTick(() => {
      drawCanvas()
    })
  },
)

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

function renderHeader(ctx: CanvasRenderingContext2D) {
  // Header background
  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, 0, width.value, 32)

  // Header borders
  ctx.strokeStyle = '#e7e7e9'
  ctx.lineWidth = 1

  // Bottom border
  ctx.beginPath()
  ctx.moveTo(0, 32)
  ctx.lineTo(width.value, 32)
  ctx.stroke()

  const { start: startColIndex, end: endColIndex } = colSlice.value
  const visibleCols = columns.value.slice(startColIndex, endColIndex)

  let initialOffset = 0
  for (let i = 0; i < startColIndex; i++) {
    initialOffset += parseInt(columns.value[i].width, 10)
  }

  // Regular columns
  ctx.fillStyle = '#6a7184'
  ctx.font = '550 12px Manrope'
  ctx.textBaseline = 'middle'
  ctx.imageSmoothingEnabled = false

  let xOffset = initialOffset
  visibleCols.forEach((column) => {
    const width = parseInt(column.width, 10)
    const truncatedText = truncateText(ctx, column.title!, width - 20)

    ctx.fillText(truncatedText, xOffset + 10 - scrollLeft.value, 16)

    xOffset += width

    ctx.beginPath()
    ctx.moveTo(xOffset - scrollLeft.value, 0)
    ctx.lineTo(xOffset - scrollLeft.value, 32)
    ctx.stroke()
  })

  // Fixed columns
  const fixedCols = columns.value.filter((col) => col.fixed)
  if (fixedCols.length) {
    xOffset = 0

    fixedCols.forEach((column, index) => {
      const width = parseInt(column.width, 10)

      // Draw background
      ctx.fillStyle = '#f4f4f5'
      ctx.fillRect(xOffset, 0, width, 32)

      // Draw title
      ctx.fillStyle = '#6a7184'
      const truncatedText = truncateText(ctx, column.title!, width - 20)
      ctx.fillText(truncatedText, xOffset + 10, 16)

      xOffset += width

      // Draw vertical border
      ctx.strokeStyle = index === fixedCols.length - 1 ? '#d1d1d1' : '#e7e7e9'
      ctx.beginPath()
      ctx.moveTo(xOffset, 0)
      ctx.lineTo(xOffset, 32)
      ctx.stroke()
    })
  }
}

const renderActiveState = (ctx: CanvasRenderingContext2D, activeState) => {
  if (activeState) {
    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height - 2, 2)
  }
}

function renderRows(ctx: CanvasRenderingContext2D) {
  const { start: startRowIndex, end: endRowIndex } = rowSlice.value
  const { start: startColIndex, end: endColIndex } = colSlice.value
  const visibleCols = columns.value.slice(startColIndex, endColIndex)

  let yOffset = 32
  let activeState = null

  let initialXOffset = 0
  for (let i = 0; i < startColIndex; i++) {
    initialXOffset += parseInt(columns.value[i].width, 10)
  }

  for (let rowIdx = startRowIndex; rowIdx < endRowIndex; rowIdx++) {
    const row = cachedRows.value.get(rowIdx)

    // Row background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, yOffset, width.value, rowHeight.value)

    if (row) {
      let xOffset = initialXOffset

      visibleCols.forEach((column, colIdx) => {
        const width = parseInt(column.width, 10)
        const absoluteColIdx = startColIndex + colIdx

        if (column.fixed) {
          xOffset += width
          return
        }

        ctx.strokeStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.moveTo(xOffset - scrollLeft.value, yOffset)
        ctx.lineTo(xOffset - scrollLeft.value, yOffset + rowHeight.value)
        ctx.stroke()

        const isActive = activeCell.value.row === rowIdx && activeCell.value.column === absoluteColIdx

        if (isActive) {
          activeState = {
            col: column,
            x: xOffset - scrollLeft.value,
            y: yOffset,
            width,
            height: rowHeight.value,
          }
        }

        const value = column.id === 'row_number' ? row.rowMeta.rowIndex + 1 : row.row[column.title]

        renderCell(
          ctx,
          metaColumnById.value[column.id] ?? {
            uidt: UITypes.AutoNumber,
          },
          {
            value,
            x: xOffset - scrollLeft.value,
            y: yOffset,
            width,
            height: rowHeight.value,
            row: row.row,
            selected: isActive,
            pv: column.pv,
          },
        )
        xOffset += width
      })

      renderActiveState(ctx, activeState)
      activeState = null

      // Draw fixed columns if any (overlay on top)
      const fixedCols = columns.value.filter((col) => col.fixed)
      if (fixedCols.length) {
        xOffset = 0

        fixedCols.forEach((column, index) => {
          const width = parseInt(column.width, 10)
          const value = column.id === 'row_number' ? row.rowMeta.rowIndex + 1 : row.row[column.title]
          const colIdx = columns.value.findIndex((col) => col.id === column.id)
          const isActive = activeCell.value.row === rowIdx && activeCell.value.column === colIdx

          if (isActive) {
            activeState = {
              col: column,
              x: xOffset,
              y: yOffset,
              width,
              height: rowHeight.value,
            }
          }

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(xOffset, yOffset, width, rowHeight.value)

          renderCell(
            ctx,
            metaColumnById.value[column.id] ?? {
              uidt: UITypes.AutoNumber,
            },
            {
              value,
              x: xOffset,
              y: yOffset,
              width,
              height: rowHeight.value,
              row: row.row,
              selected: isActive,
              pv: column.pv,
            },
          )

          ctx.strokeStyle = index === fixedCols.length - 1 ? '#f4f4f5' : '#d1d1d1'
          ctx.beginPath()
          ctx.moveTo(xOffset, yOffset)
          ctx.lineTo(xOffset, yOffset + rowHeight.value)
          ctx.stroke()

          xOffset += width
        })
      }
    } else {
      // Loading state
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, yOffset, totalWidth.value, rowHeight.value)
    }

    // Bottom border for each row
    ctx.strokeStyle = '#e7e7e9'
    ctx.beginPath()
    ctx.moveTo(0, yOffset + rowHeight.value)
    ctx.lineTo(width.value, yOffset + rowHeight.value)
    ctx.stroke()

    yOffset += rowHeight.value
  }
  renderActiveState(ctx, activeState)
}

function drawCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1

  canvas.width = width.value * dpr
  canvas.height = height.value * dpr

  canvas.style.width = `${width.value}px`
  ctx.scale(dpr, dpr)

  renderHeader(ctx)
  renderRows(ctx)
}

function handleMouseClick(e: MouseEvent) {
  editEnabled.value = null
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top - 32
  const rowIndex = Math.floor((y + scrollTop.value) / rowHeight.value)

  if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
    activeCell.value = { row: -1, column: -1 }
    requestAnimationFrame(drawCanvas)
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
        y: (rowIndex + 1) * rowHeight.value - scrollTop.value,
        column: metaColumnById.value[clickedColumn.id],
        row: cachedRows.value.get(rowIndex),
        height: rowHeight.value,
        width: parseInt(clickedColumn.width, 10),
      }
    }
    requestAnimationFrame(drawCanvas)
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
      drawCanvas()
    })
  },
})

watch([rowSlice, cachedRows, colSlice], () => {
  requestAnimationFrame(drawCanvas)
})

onMounted(async () => {
  canvasRef.value?.addEventListener('mousemove', handleMouseMove)
  canvasRef.value?.addEventListener('mousedown', handleMouseDown)

  await syncCount()
  calculateSlices()
  await updateVisibleRows()
  requestAnimationFrame(drawCanvas)
})
onBeforeUnmount(() => {
  canvasRef.value?.removeEventListener('mousemove', handleMouseMove)
  canvasRef.value?.removeEventListener('mousedown', handleMouseDown)
})
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
          top: `${rowHeight * (editEnabled.rowIndex + 1)}px`,
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

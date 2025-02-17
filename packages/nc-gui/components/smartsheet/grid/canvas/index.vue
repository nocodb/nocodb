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

// VModels
const vSelectedAllRecords = useVModel(props, 'selectedAllRecords', emits)

// Props to Refs
const totalRows = toRef(props, 'totalRows')
const chunkStates = toRef(props, 'chunkStates')
const cachedRows = toRef(props, 'data')
const rowHeightEnum = toRef(props, 'rowHeightEnum')
const selectedRows = toRef(props, 'selectedRows')

// Refs
const containerRef = ref()
const wrapperRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)

// Injections
const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
const reloadVisibleDataHook = inject(ReloadVisibleDataHookInj, undefined)

// Composables
const { height, width } = useElementSize(wrapperRef)
const { aggregations, loadViewAggregate } = useViewAggregateOrThrow()

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
  hoverRow,
  selection,
  partialRowHeight,

  // MouseSelectionHandler
  onMouseMoveSelectionHandler,
  onMouseDownSelectionHandler,
  onMouseUpSelectionHandler,

  // FillHandleHandler
  onMouseDownFillHandlerStart,
  onMouseMoveFillHandlerMove,
  onMouseUpFillHandlerEnd,
  isFillHandlerActive,
} = useCanvasTable({
  rowHeightEnum,
  cachedRows,
  clearCache,
  chunkStates,
  totalRows,
  loadData,
  scrollLeft,
  width,
  height,
  scrollToCell,
  scrollTop,
  aggregations,
  vSelectedAllRecords,
  selectedRows,
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

function handleMouseDown(e: MouseEvent) {
  editEnabled.value = null
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const y = e.clientY - rect.top
  const x = e.clientX - rect.left

  if (y > height.value - 36) {
    return
  }

  onMouseDownFillHandlerStart(e)
  if (isFillHandlerActive.value) return

  selection.value.clear()

  // Header interactions
  if (y <= 32) {
    startResize(e)
    if (!resizeableColumn.value) {
      startDrag(e.clientX - rect.left)
    }
  } else {
    const rowIndex = Math.floor((y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
    if (rowIndex < rowSlice.value.start || rowIndex >= rowSlice.value.end) {
      activeCell.value = { row: -1, column: -1 }
      triggerRefreshCanvas()
    }
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
        if (clickedColumn?.virtual) return
        editEnabled.value = {
          rowIndex,
          x: xOffset + scrollLeft.value,
          y: (rowIndex + 1) * rowHeight.value + 32,
          column: metaColumnById.value[clickedColumn.id],
          row: cachedRows.value.get(rowIndex),
          height: rowHeight.value,
          width: parseInt(clickedColumn.width, 10) + 2,
        }
      } else {
        onMouseDownSelectionHandler(e)
      }
      triggerRefreshCanvas()
    }
  }
}

function scrollToCell(row: number, column: number) {
  if (!containerRef.value) return

  const cellTop = row * rowHeight.value
  const cellBottom = cellTop + rowHeight.value + 64
  const scrollTop = containerRef.value.scrollTop
  const viewportHeight = containerRef.value.clientHeight

  if (cellTop < scrollTop) {
    containerRef.value.scrollTop = cellTop
  } else if (cellBottom > scrollTop + viewportHeight) {
    containerRef.value.scrollTop = cellBottom - viewportHeight
  }

  let cellLeft = 0
  let cellRight = 0

  const fixedWidth = columns.value.filter((col) => col.fixed).reduce((sum, col) => sum + parseInt(col.width, 10), 0) + 128

  for (let i = 0; i < column; i++) {
    if (!columns.value[i].fixed) {
      cellLeft += parseInt(columns.value[i].width, 10)
    }
  }
  cellRight = cellLeft + parseInt(columns.value[column].width, 10)

  cellLeft += fixedWidth
  cellRight += fixedWidth

  const scrollLeft = containerRef.value.scrollLeft
  const viewportWidth = containerRef.value.clientWidth

  if (cellLeft < scrollLeft + fixedWidth) {
    containerRef.value.scrollLeft = cellLeft - fixedWidth
  } else if (cellRight > scrollLeft + viewportWidth) {
    containerRef.value.scrollLeft = cellRight - viewportWidth
  }
}

const handleMouseUp = (e: MouseEvent) => {
  e.preventDefault()
  onMouseUpFillHandlerEnd()
  onMouseUpSelectionHandler(e)
}

const handleMouseMove = (e: MouseEvent) => {
  if (isFillHandlerActive.value) {
    onMouseMoveFillHandlerMove(e)
  } else if (isDragging.value || resizeableColumn.value) {
    if (e.clientX >= window.innerWidth - 200) {
      containerRef.value.scrollLeft += 10
    } else if (e.clientX <= 200) {
      containerRef.value.scrollLeft -= 10
    }
  } else {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    if (y <= 32) {
      resizeMouseMove(e)
    } else {
      hoverRow.value = Math.floor((y - 32 + partialRowHeight.value) / rowHeight.value) + rowSlice.value.start
      onMouseMoveSelectionHandler(e)
    }
    requestAnimationFrame(triggerRefreshCanvas)
  }
}

const reloadViewDataHookHandler = async (param) => {
  if (param?.fieldAdd) {
    containerRef.value?.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }
  clearCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)

  await syncCount()

  calculateSlices()

  await Promise.all([updateVisibleRows()])

  triggerRefreshCanvas()
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

const triggerReload = () => {
  calculateSlices()
  updateVisibleRows()
}

reloadViewDataHook.on(reloadViewDataHookHandler)
reloadVisibleDataHook?.on(triggerReload)

onBeforeUnmount(() => {
  reloadViewDataHook.off(reloadViewDataHookHandler)
  reloadVisibleDataHook?.off(triggerReload)
})

onMounted(async () => {
  await syncCount()
  calculateSlices()
  triggerRefreshCanvas()
  await loadViewAggregate()
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
          @mouseup="handleMouseUp"
        >
        </canvas>
      </div>
      <div
        v-if="editEnabled?.row"
        :style="{
          top: `${rowHeight * editEnabled.rowIndex + 32}px`,
          left: `${editEnabled.x}px`,
          width: `${editEnabled.width}px`,
          height: `${editEnabled.height}px`,
          borderRadius: '2px',
        }"
        class="nc-canvas-table-editable-cell-wrapper"
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

<style scoped lang="scss">
.nc-canvas-table-editable-cell-wrapper {
  @apply px-2 absolute bg-white border-2 !rounded border-[#3366ff];
}
</style>

<script setup lang="ts">
import { type TableType, UITypes, type ViewType } from 'nocodb-sdk'
import type { ColumnType } from 'ant-design-vue/lib/table'
import type { CellRange } from '../../../../composables/useMultiSelect/cellRange'
import { normalizeWidth, useColumnResize } from './composables/useColumnResize'
import { useCellRenderer } from './cells'
import { roundedRect } from './utils/canvas'
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
const scrollTop = ref(0)
const scrollLeft = ref(0)
const rowSlice = ref({ start: 0, end: 0 })
const activeCell = ref({ row: -1, column: -1 })
const editEnabled = ref<{
  rowIndex: number
  column: ColumnType
  row: Row
  x: number
  y: number
  width: number
  height: number
} | null>(null)

// Injections
const fields = inject(FieldsInj, ref([]))
const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

// Composables
const { gridViewCols, updateGridViewColumn, metaColumnById } = useViewColumnsOrThrow()
const { height } = useElementSize(containerRef)
const { renderCell } = useCellRenderer()

// Computed
const visibleColumns = computed(() => {
  const cols = fields.value.map((f) => {
    const gridViewCol = gridViewCols.value[f.id]

    return {
      id: f.id,
      grid_column_id: gridViewCol.id,
      title: f.title,
      uidt: f.uidt,
      width: gridViewCol.width,
      fixed: f.pv,
      pv: !!f.pv,
    }
  })
  cols.splice(0, 0, {
    id: 'row_number',
    grid_column_id: 'row_number',
    title: '#',
    uidt: UITypes.AutoNumber,
    width: '64',
    fixed: true,
    pv: false,
  })
  return cols
})

const totalWidth = computed(() => {
  return visibleColumns.value.reduce((acc, col) => acc + +col.width.split('px')[0], 0) + 256
})

const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * 32
  const headerHeight = 32
  return rowsHeight + headerHeight
})

const { handleMouseMove, handleMouseDown, cleanupResize } = useColumnResize(
  canvasRef,
  visibleColumns,
  (columnId, newWidth) => {
    const columnIndex = visibleColumns.value.findIndex((col) => col.id === columnId)
    if (columnIndex !== -1) {
      try {
        const normalizedWidth = normalizeWidth(metaColumnById.value[columnId], newWidth)
        visibleColumns.value[columnIndex].width = `${normalizedWidth}px`
        requestAnimationFrame(drawCanvas)
      } catch (error) {
        console.error('Error updating column width:', error)
        cleanupResize()
      }
    }
  },
  (columnId, width) => {
    const columnIndex = visibleColumns.value.findIndex((col) => col.id === columnId)

    if (columnIndex === -1) return

    const normalizedWidth = normalizeWidth(metaColumnById.value[columnId], width)
    updateGridViewColumn(columnId, { width: `${normalizedWidth}px` })

    nextTick(() => {
      drawCanvas()
    })
  },
)

const CHUNK_SIZE = 50
const BUFFER_SIZE = 100
const INITIAL_LOAD_SIZE = 100
const PREFETCH_THRESHOLD = 40

const fetchChunk = async (chunkId: number, isInitialLoad = false) => {
  if (chunkStates.value[chunkId]) return

  const offset = chunkId * CHUNK_SIZE
  const limit = isInitialLoad ? INITIAL_LOAD_SIZE : CHUNK_SIZE

  if (offset >= totalRows.value) {
    return
  }

  chunkStates.value[chunkId] = 'loading'
  if (isInitialLoad) {
    chunkStates.value[chunkId + 1] = 'loading'
  }
  try {
    const newItems = await loadData({ offset, limit })
    newItems.forEach((item) => cachedRows.value.set(item.rowMeta.rowIndex, item))

    chunkStates.value[chunkId] = 'loaded'
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = 'loaded'
    }
  } catch (error) {
    console.error(`Error fetching chunk ${chunkId}:`, error)
    chunkStates.value[chunkId] = undefined
    if (isInitialLoad) {
      chunkStates.value[chunkId + 1] = undefined
    }
  }
}

const updateVisibleRows = async () => {
  const { start, end } = rowSlice.value

  const firstChunkId = Math.floor(start / CHUNK_SIZE)
  const lastChunkId = Math.floor((end - 1) / CHUNK_SIZE)

  const chunksToFetch = new Set<number>()

  for (let chunkId = firstChunkId; chunkId <= lastChunkId; chunkId++) {
    if (!chunkStates.value[chunkId]) chunksToFetch.add(chunkId)
  }

  const nextChunkId = lastChunkId + 1
  if (end % CHUNK_SIZE > CHUNK_SIZE - PREFETCH_THRESHOLD && !chunkStates.value[nextChunkId]) {
    chunksToFetch.add(nextChunkId)
  }

  const prevChunkId = firstChunkId - 1
  if (prevChunkId >= 0 && start % CHUNK_SIZE < PREFETCH_THRESHOLD && !chunkStates.value[prevChunkId]) {
    chunksToFetch.add(prevChunkId)
  }

  if (chunksToFetch.size > 0) {
    const isInitialLoad = firstChunkId === 0 && !chunkStates.value[0]

    if (isInitialLoad) {
      await fetchChunk(0, true)
      chunksToFetch.delete(0)
      chunksToFetch.delete(1)
    }

    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId)))
  }

  clearCache(Math.max(0, start - BUFFER_SIZE), Math.min(totalRows.value, end + BUFFER_SIZE))
}

const calculateSlices = () => {
  if (containerRef.value.clientWidth === 0) {
    setTimeout(calculateSlices, 50)
  }
  const startIndex = Math.max(0, Math.floor(scrollTop.value / 32))
  const visibleCount = Math.ceil(containerRef.value.clientHeight / 32)
  const endIndex = Math.min(startIndex + visibleCount, totalRows.value)

  const newEnd = Math.min(totalRows.value, Math.max(endIndex, startIndex + 50))

  if (startIndex !== rowSlice.value.start || newEnd !== rowSlice.value.end) {
    rowSlice.value = { start: startIndex, end: newEnd }
  }

  updateVisibleRows()
}

function renderHeader(ctx: CanvasRenderingContext2D) {
  // Header background
  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, 0, totalWidth.value, 32)

  // Header borders
  ctx.strokeStyle = '#e7e7e9'
  ctx.lineWidth = 1

  // Bottom border
  ctx.beginPath()
  ctx.moveTo(0, 32)
  ctx.lineTo(totalWidth.value, 32)
  ctx.stroke()

  // Left border
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 32)
  ctx.stroke()

  // Right border
  ctx.beginPath()
  ctx.moveTo(totalWidth.value, 0)
  ctx.lineTo(totalWidth.value, 32)
  ctx.stroke()

  // Regular columns
  ctx.fillStyle = '#6a7184'
  ctx.font = '550 12px Manrope'
  ctx.textBaseline = 'middle'
  ctx.imageSmoothingEnabled = false

  let xOffset = 0
  visibleColumns.value.forEach((column) => {
    const width = parseInt(column.width, 10)
    ctx.fillText(column.title, xOffset + 10, 16)

    xOffset += width

    ctx.beginPath()
    ctx.moveTo(xOffset, 0)
    ctx.lineTo(xOffset, 32)
    ctx.stroke()
  })

  // Fixed columns
  const fixedCols = visibleColumns.value.filter((col) => col.fixed)
  if (fixedCols.length) {
    xOffset = scrollLeft.value

    fixedCols.forEach((column, index) => {
      const width = parseInt(column.width, 10)

      // Draw background
      ctx.fillStyle = '#f4f4f5'
      ctx.fillRect(xOffset, 0, width, 32)

      // Draw title
      ctx.fillStyle = '#6a7184'
      ctx.fillText(column.title!, xOffset + 10, 16)

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

function renderRows(ctx: CanvasRenderingContext2D) {
  const { start: startIndex, end: endIndex } = rowSlice.value
  let yOffset = 32
  let activeState = null

  for (let rowIdx = startIndex; rowIdx < endIndex; rowIdx++) {
    const row = cachedRows.value.get(rowIdx)

    // Row background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, yOffset, totalWidth.value, 32)

    if (row) {
      let xOffset = 0
      visibleColumns.value.forEach((column, index) => {
        const width = parseInt(column.width, 10)

        ctx.strokeStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.moveTo(xOffset, yOffset)
        ctx.lineTo(xOffset, yOffset + 32)
        ctx.stroke()

        const isActive = activeCell.value.row === rowIdx && activeCell.value.column === index

        if (isActive) {
          activeState = {
            x: xOffset,
            y: yOffset,
            width,
            height: 32,
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
            x: xOffset,
            y: yOffset,
            width,
            height: 32,
            row: row.row,
            selected: isActive,
            pv: column.pv,
          },
        )
        xOffset += width
      })

      // Draw fixed columns if any (overlay on top)
      const fixedCols = visibleColumns.value.filter((col) => col.fixed)
      if (fixedCols.length) {
        xOffset = scrollLeft.value

        fixedCols.forEach((column, index) => {
          const width = parseInt(column.width, 10)
          const value = column.id === 'row_number' ? row.rowMeta.rowIndex + 1 : row.row[column.title]

          const isActive = activeCell.value.row === rowIdx && activeCell.value.column === index

          if (isActive) {
            activeState = {
              x: xOffset,
              y: yOffset,
              width,
              height: 32,
            }
          }

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(xOffset, yOffset, width, 32)

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
              height: 32,
              row: row.row,
              selected: isActive,
              pv: column.pv,
            },
          )

          ctx.strokeStyle = index === fixedCols.length - 1 ? '#f4f4f5' : '#d1d1d1'
          ctx.beginPath()
          ctx.moveTo(xOffset, yOffset)
          ctx.lineTo(xOffset, yOffset + 32)
          ctx.stroke()

          xOffset += width
        })
      }
    } else {
      // Loading state
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, yOffset, totalWidth.value, 32)
    }

    // Bottom border for each row
    ctx.strokeStyle = '#e7e7e9'
    ctx.beginPath()
    ctx.moveTo(0, yOffset + 32)
    ctx.lineTo(totalWidth.value, yOffset + 32)
    ctx.stroke()

    yOffset += 32
  }
  if (activeState) {
    ctx.strokeStyle = '#3366ff'
    ctx.lineWidth = 2
    roundedRect(ctx, activeState.x, activeState.y, activeState.width, activeState.height, 2)
  }
}
function drawCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1

  canvas.width = totalWidth.value * dpr
  canvas.height = height.value * dpr

  canvas.style.width = `${totalWidth.value}px`
  ctx.scale(dpr, dpr)

  renderHeader(ctx)
  renderRows(ctx)
}

function handleMouseClick(e: MouseEvent) {
  editEnabled.value = null
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const x = e.clientX - rect.left
  const y = e.clientY - rect.top - 32

  const rowIndex = Math.floor((y + scrollTop.value) / 32)

  let xOffset = 0
  let clickedColumn = null

  // Check fixed columns first
  const fixedCols = visibleColumns.value.filter((col) => col.fixed)
  if (fixedCols.length) {
    xOffset = scrollLeft.value
    for (const column of fixedCols) {
      const width = parseInt(column.width, 10)
      if (x >= xOffset && x < xOffset + width) {
        clickedColumn = column
        break
      }
      xOffset += width
    }
  }

  // If not clicked on fixed column, check regular columns
  if (!clickedColumn) {
    xOffset = 0
    for (const column of visibleColumns.value) {
      const width = parseInt(column.width, 10)
      if (x >= xOffset && x < xOffset + width) {
        clickedColumn = column
        break
      }
      xOffset += width
    }
  }

  const colIndex = visibleColumns.value.findIndex((col) => col.id === clickedColumn?.id)

  if (clickedColumn) {
    // Update active cell
    activeCell.value = { row: rowIndex, column: colIndex }

    if (e.detail === 2) {
      editEnabled.value = {
        rowIndex,
        x: xOffset,
        y: (rowIndex + 1) * 32 - scrollTop.value,
        column: metaColumnById.value[clickedColumn.id],
        row: cachedRows.value.get(rowIndex),
        height: 32,
        width: parseInt(clickedColumn.width, 10),
      }
    }
    // Redraw canvas
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

watch([rowSlice, cachedRows], () => {
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
  <div class="w-full h-full">
    <div ref="containerRef" class="relative w-full h-full overflow-auto border border-gray-200">
      <div
        class="relative"
        :style="{
          width: `${totalWidth}px`,
          height: `${totalHeight}px`,
        }"
      >
        <canvas
          ref="canvasRef"
          class="sticky top-0"
          :height="`${height}px`"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @click="handleMouseClick"
        >
        </canvas>
        <div
          v-if="editEnabled"
          :style="{
            top: `${32 * (editEnabled.rowIndex + 1)}px`,
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
  </div>
</template>

<style scoped lang="scss"></style>

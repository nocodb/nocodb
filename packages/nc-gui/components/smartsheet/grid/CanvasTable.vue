<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { normalizeWidth, useColumnResize } from './canvasUtils/useColumnResize'

// Refs
const canvasRef = ref()
const containerRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)
const rowSlice = ref({ start: 0, end: 0 })

// Injections
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))
const view = inject(ActiveViewInj, ref())
const { xWhere } = useSmartsheetStoreOrThrow()
const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

// Composables
const { totalRows, syncCount, cachedRows, chunkStates, loadData, clearCache } = useGridViewData(
  meta,
  view,
  xWhere,
  reloadVisibleDataHook,
)
const { gridViewCols, updateGridViewColumn, metaColumnById } = useViewColumnsOrThrow()
const { height } = useElementSize(containerRef)

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
    }
  })
  cols.splice(0, 0, {
    id: 'row_number',
    grid_column_id: 'row_number',
    title: '#',
    uidt: UITypes.AutoNumber,
    width: '64',
    fixed: true,
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

function renderRows(ctx: CanvasRenderingContext2D) {
  const { start: startIndex, end: endIndex } = rowSlice.value
  let yOffset = 32

  for (let rowIdx = startIndex; rowIdx < endIndex; rowIdx++) {
    const row = cachedRows.value.get(rowIdx)

    // Row background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, yOffset, totalWidth.value, 32)

    if (row) {
      let xOffset = 0
      visibleColumns.value.forEach((column) => {
        const width = parseInt(column.width, 10)
        const value = row.row[column.title]

        ctx.strokeStyle = '#f4f4f5'
        ctx.beginPath()
        ctx.moveTo(xOffset, yOffset)
        ctx.lineTo(xOffset, yOffset + 32)
        ctx.stroke()

        // Cell content
        ctx.fillStyle = '#000000'
        ctx.font = '400 12px Manrope'
        ctx.textBaseline = 'middle'
        ctx.fillText(
          value?.toString() ?? '',
          xOffset + 10,
          yOffset + 16,
        )

        xOffset += width
      })

      // Draw fixed columns if any (overlay on top)
      const fixedCols = visibleColumns.value.filter((col) => col.fixed)
      if (fixedCols.length) {
        xOffset = scrollLeft.value
        fixedCols.forEach((column, index) => {
          const width = parseInt(column.width, 10)
          const value = row.row[column.title]

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(xOffset, yOffset, width, 32)

          // Cell content
          ctx.fillStyle = '#000000'
          ctx.fillText(value?.toString() ?? '', xOffset + 10, yOffset + 16)

          // Cell border
          ctx.strokeStyle = index === fixedCols.length - 1 ? '#d1d1d1' : '#f4f4f5'
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
        >
        </canvas>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

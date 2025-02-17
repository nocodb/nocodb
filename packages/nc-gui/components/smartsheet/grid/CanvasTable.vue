<script setup lang="ts">
import { type ColumnType, UITypes } from 'nocodb-sdk'
import { useColumnResize } from './canvasUtils/useColumnResize'
const canvasRef = ref()

const containerRef = ref()

const scrollTop = ref(0)

const scrollLeft = ref(0)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { xWhere } = useSmartsheetStoreOrThrow()

const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

const { totalRows, syncCount, cachedRows } = useGridViewData(meta, view, xWhere, reloadVisibleDataHook)

const fields = inject(FieldsInj, ref([]))

const { gridViewCols, resizingColOldWith, metaColumnById } = useViewColumnsOrThrow()

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
    uidt: 'number',
    width: '64',
    fixed: true,
  })
  return cols
})

const totalWidth = computed(() => {
  return visibleColumns.value.reduce((acc, col) => acc + +col.width.split('px')[0], 0)
})

const totalHeight = computed(() => {
  const rowsHeight = totalRows.value * 32
  const headerHeight = 32
  return rowsHeight + headerHeight
})

const columnWidthLimit = {
  [UITypes.Attachment]: {
    minWidth: 80,
    maxWidth: Number.POSITIVE_INFINITY,
  },
  [UITypes.Button]: {
    minWidth: 100,
    maxWidth: 320,
  },
}
const normalizeWidth = (col: ColumnType, width: number) => {
  if (col.uidt! in columnWidthLimit) {
    const { minWidth, maxWidth } = columnWidthLimit[col.uidt]

    if (minWidth < width && width < maxWidth) return width
    if (width < minWidth) return minWidth
    if (width > maxWidth) return maxWidth
  }
  return width
}

const { drawResizeHandle, handleMouseMove, handleMouseDown } = useColumnResize(
  canvasRef,
  visibleColumns,
  (columnId, newWidth) => {
    const columnIndex = visibleColumns.value.findIndex((col) => col.id === columnId)
    if (columnIndex !== -1) {
      const normalizedWidth = normalizeWidth(metaColumnById.value[columnId], newWidth)
      visibleColumns.value[columnIndex].width = `${normalizedWidth}px`
      requestAnimationFrame(drawCanvas)
    }
  },
)

const isRendering = ref(false)

const drawCanvas = () => {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1

  canvas.width = totalWidth.value * dpr
  canvas.height = totalHeight.value * dpr

  canvas.style.width = `${totalWidth.value}px`
  canvas.style.height = `${totalHeight.value}px`

  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, 0, totalWidth.value, 32)

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

  const fixedCols = visibleColumns.value.filter((col) => col.fixed)

  if (fixedCols.length) {
    xOffset = scrollLeft.value

    fixedCols.forEach((column, index) => {
      ctx.fillStyle = '#f4f4f5'
      const width = parseInt(column.width, 10)

      // Draw background
      ctx.fillRect(xOffset, 0, width, 32)

      ctx.fillStyle = '#6a7184'
      ctx.fillText(column.title, xOffset + 10, 16)

      xOffset += width

      // Draw vertical border
      ctx.strokeStyle = index === fixedCols.length - 1 ? '#d1d1d1' : '#e7e7e9' // Darker border for last fixed column
      ctx.beginPath()
      ctx.moveTo(xOffset, 0)
      ctx.lineTo(xOffset, 32)
      ctx.stroke()
    })
  }

  drawResizeHandle(ctx)
}

onMounted(async () => {
  isRendering.value = true
  requestAnimationFrame(drawCanvas)
})

onBeforeUnmount(() => {
  isRendering.value = false
})

let rafnId: number | null = null

useScroll(containerRef, {
  behavior: 'instant',
  onScroll: (e) => {
    if (rafnId) cancelAnimationFrame(rafnId)

    rafnId = requestAnimationFrame(() => {
      scrollTop.value = e.target.scrollTop
      scrollLeft.value = e.target.scrollLeft

      drawCanvas()
    })
  },
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
        <canvas ref="canvasRef" :width="`${totalWidth}px`" @mousedown="handleMouseDown" @mousemove="handleMouseMove"> </canvas>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

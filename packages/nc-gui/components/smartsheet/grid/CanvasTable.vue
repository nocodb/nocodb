<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { normalizeWidth, useColumnResize } from './canvasUtils/useColumnResize'

// Refs
const canvasRef = ref()
const containerRef = ref()
const scrollTop = ref(0)
const scrollLeft = ref(0)

// Injections
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))
const view = inject(ActiveViewInj, ref())
const { xWhere } = useSmartsheetStoreOrThrow()
const reloadVisibleDataHook = createEventHook()

provide(ReloadVisibleDataHookInj, reloadVisibleDataHook)

// Composables
const { totalRows, syncCount, cachedRows } = useGridViewData(meta, view, xWhere, reloadVisibleDataHook)
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

  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, 0, totalWidth.value, 32)

  ctx.fillStyle = '#f4f4f5'

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
}

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

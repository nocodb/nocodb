import { parseCellWidth } from '../utils/cell'
import { getColumnDropTargetIndex } from '../utils/headerUtils'

export function useColumnReorder(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  columns: ComputedRef<CanvasGridColumn[]>,
  colSlice: Ref<{ start: number; end: number }>,
  scrollLeft: Ref<number>,
  drawCanvas: () => void,
  dragOver: Ref<{ id: string; index: number } | null>,
  emit: (event: string, ...args: any[]) => void,
  isViewOperationsAllowed: ComputedRef<boolean>,
) {
  const isLocked = inject(IsLockedInj, ref(false))
  const isDragging = ref(false)
  const dragStart = ref<{
    id: string
    index: number
    startX: number
  } | null>(null)

  const findColumnAtPosition = (x: number) => {
    // While a drag is in progress, targets must stay on the same side of the
    // freeze divider — fields can be reordered within the frozen band or within
    // the scrollable area, never across.
    const sourceCol = dragStart.value ? columns.value.find((c) => c.id === dragStart.value!.id) : null
    const matchesSide = (col: CanvasGridColumn) => !sourceCol || !!col.fixed === !!sourceCol.fixed

    let currentX = 0
    const fixedCols = columns.value.filter((col) => col.fixed)
    for (const col of fixedCols) {
      const width = parseCellWidth(col.width)
      if (x >= currentX && x < currentX + width) {
        // row-number gutter is never a drag source/target
        if (!col.uidt) return null
        return matchesSide(col) ? col : null
      }
      currentX += width
    }

    let accWidth = fixedCols.reduce((sum, col) => sum + parseCellWidth(col.width), 0)
    for (let i = 0; i < colSlice.value.start; i++) {
      if (!columns.value[i]?.fixed) {
        accWidth += parseCellWidth(columns.value[i]?.width)
      }
    }

    currentX = accWidth - scrollLeft.value
    for (let i = colSlice.value.start; i < colSlice.value.end; i++) {
      const column = columns.value[i]
      if (!column?.fixed) {
        const width = parseCellWidth(column?.width)
        if (x >= currentX && x < currentX + width) return column && matchesSide(column) ? column : null
        currentX += width
      }
    }
    return null
  }

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging.value || !dragStart.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const col = findColumnAtPosition(x)

    if (col && col.id !== dragStart.value.id) {
      dragOver.value = {
        id: col.id,
        index: columns.value.findIndex((c) => c.id === col.id),
      }
      requestAnimationFrame(drawCanvas)
    } else if (!col && dragOver.value) {
      // No valid target under the pointer (other side of the freeze divider, or
      // the row-number gutter) — drop the pending target so mouseup cancels
      // instead of committing the last one we saw.
      dragOver.value = null
      requestAnimationFrame(drawCanvas)
    }
  }

  const dragEndHandler = () => {
    if (dragStart.value && dragOver.value) {
      emit('reorderColumns', dragStart.value.index, getColumnDropTargetIndex(columns.value, dragOver.value.index))
    }
    cleanup()
  }

  function cleanup() {
    isDragging.value = false
    dragStart.value = null
    dragOver.value = null

    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', dragEndHandler)

    requestAnimationFrame(drawCanvas)
  }

  const startDrag = (x: number) => {
    if (isLocked.value || !isViewOperationsAllowed.value) return
    const col = findColumnAtPosition(x)
    // The display value is always the first frozen field — it can be a drop
    // target (insert right after it) but never a drag source.
    if (col && !col.pv) {
      isDragging.value = true
      dragStart.value = {
        id: col.id,
        index: columns.value.findIndex((c) => c.id === col.id),
        startX: x,
      }
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', dragEndHandler)
    }
  }

  onBeforeUnmount(cleanup)

  return {
    isDragging,
    dragStart,
    startDrag,
    findColumnAtPosition,
  }
}

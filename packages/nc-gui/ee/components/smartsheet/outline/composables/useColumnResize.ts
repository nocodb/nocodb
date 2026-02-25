import { parseCellWidth } from '../../grid/canvas/utils/cell'
import { MIN_COLUMN_WIDTH, RESIZE_HANDLE_WIDTH } from './constants'

export interface HeaderContext {
  columns: CanvasGridColumn[]
  startX: number // left edge of first column (already adjusted for scroll)
}

/**
 * Column resize for the outline view canvas.
 * Works on both root header and sub-headers via `resolveHeader`.
 */
export function useColumnResize(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  drawCanvas: () => void,
  /** Given canvas-local (x, y), return the columns + startX for that header, or null */
  resolveHeader: (x: number, y: number) => HeaderContext | null,
  onResize: (columnId: string, width: number) => void,
  onResizeEnd: (columnId: string, width: number) => void,
) {
  const isResizing = ref(false)
  const resizingColumn = ref<{
    id: string
    initialWidth: number
    startX: number
    currentWidth: number
  } | null>(null)

  const isLocked = inject(IsLockedInj, ref(false))

  /** Find a resizeable column border near x in the given header context */
  function findResizeTarget(x: number, y: number): { id: string; width: number } | null {
    const ctx = resolveHeader(x, y)
    if (!ctx) return null

    let currentX = ctx.startX
    for (const column of ctx.columns) {
      const w = parseCellWidth(column.width)
      const borderX = currentX + w

      if (Math.abs(x - borderX) <= RESIZE_HANDLE_WIDTH / 2) {
        return { id: column.id, width: w }
      }
      currentX += w
    }
    return null
  }

  function handleDrag(e: MouseEvent) {
    if (!isResizing.value || !resizingColumn.value) return

    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const delta = x - resizingColumn.value.startX
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizingColumn.value.initialWidth + delta)
    resizingColumn.value.currentWidth = newWidth

    onResize(resizingColumn.value.id, newWidth)
  }

  function handleMouseUp() {
    if (isResizing.value && resizingColumn.value) {
      onResizeEnd(resizingColumn.value.id, resizingColumn.value.currentWidth)
    }
    cleanup()
  }

  function cleanup() {
    isResizing.value = false
    resizingColumn.value = null
    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  /** Call from canvas mousedown — returns true if resize started */
  function startResize(e: MouseEvent): boolean {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect || isLocked.value) return false

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const target = findResizeTarget(x, y)
    if (!target) return false

    isResizing.value = true
    resizingColumn.value = {
      id: target.id,
      initialWidth: target.width,
      startX: x,
      currentWidth: target.width,
    }

    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleMouseUp)
    return true
  }

  /** Call from canvas mousemove to get cursor */
  function updateCursor(x: number, y: number): string | null {
    if (isResizing.value) return 'col-resize'
    const target = findResizeTarget(x, y)
    return target ? 'col-resize' : null
  }

  onBeforeUnmount(cleanup)

  return {
    isResizing,
    resizingColumn,
    startResize,
    updateCursor,
  }
}

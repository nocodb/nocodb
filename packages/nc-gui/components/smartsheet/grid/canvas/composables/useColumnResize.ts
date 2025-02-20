import { type ColumnType, UITypes } from 'nocodb-sdk'
import type { SetCursorType } from '../../../../../lib/types'
import { parseCellWidth } from '../utils/cell'

export function useColumnResize(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  columns: ComputedRef<CanvasGridColumn[]>,
  colSlice: Ref<{ start: number; end: number }>,
  scrollLeft: Ref<number>,
  setCursor: SetCursorType,
  onResize?: (columnId: string, width: number) => void,
  onResizeEnd?: (columnId: string, width: number) => void,
) {
  const RESIZE_HANDLE_WIDTH = 8
  const isResizing = ref(false)
  const activeColumn = ref<{
    id: string
    initialWidth: number
    startX: number
  } | null>(null)

  const mousePosition = ref<{ x: number; y: number } | null>(null)

  const resizeableColumn = computed(() => {
    if (!mousePosition.value) {
      return null
    }

    const fixedCols = columns.value.filter((col) => col.fixed)
    let currentX = 0

    for (const column of fixedCols) {
      const width = parseCellWidth(column.width)
      const nextX = currentX + width

      if (Math.abs(mousePosition.value.x - nextX) <= RESIZE_HANDLE_WIDTH / 2) {
        if (!column.uidt) return null

        return { id: column.id, width, x: currentX }
      }
      currentX = nextX
    }

    let accumulatedWidth = 0
    for (let i = 0; i < colSlice.value.start; i++) {
      if (!columns.value[i]) continue
      accumulatedWidth += parseCellWidth(columns.value[i]?.width)
    }

    currentX = accumulatedWidth - scrollLeft.value
    for (let i = colSlice.value.start; i < colSlice.value.end; i++) {
      const column = columns.value[i]!
      const width = parseCellWidth(column.width)
      const nextX = currentX + width

      if (Math.abs(mousePosition.value.x - nextX) <= RESIZE_HANDLE_WIDTH / 2) {
        return { id: column.id, width, x: currentX }
      }
      currentX = nextX
    }

    return null
  })

  const handleMouseMove = (e: MouseEvent) => {
    try {
      const rect = canvasRef.value?.getBoundingClientRect()
      if (!rect) return

      mousePosition.value = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }

      if (isResizing.value && activeColumn.value) {
        const delta = mousePosition.value.x - activeColumn.value.startX
        const newWidth = Math.max(50, activeColumn.value.initialWidth + delta)

        onResize?.(activeColumn.value.id, newWidth)
      }
    } catch (error) {
      console.error('Error in handleMouseMove:', error)
      cleanupResize()
    }
  }

  function cleanupResize() {
    isResizing.value = false
    activeColumn.value = null
    mousePosition.value = null

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  const handleMouseDown = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    mousePosition.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    const column = resizeableColumn.value
    if (!column) {
      mousePosition.value = null
      return
    }

    isResizing.value = true
    activeColumn.value = {
      id: column.id,
      initialWidth: column.width,
      startX: mousePosition.value?.x || 0,
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseUp() {
    const shouldTriggerResize = isResizing.value && activeColumn.value && mousePosition.value

    if (shouldTriggerResize && activeColumn.value && mousePosition.value) {
      const delta = mousePosition.value.x - activeColumn.value.startX
      const newWidth = Math.max(50, activeColumn.value.initialWidth + delta)
      onResizeEnd?.(activeColumn.value.id, newWidth)
    }
    cleanupResize()
  }

  onBeforeUnmount(() => {
    cleanupResize()
  })

  return {
    isResizing,
    activeColumn,
    resizeableColumn,
    handleMouseMove,
    handleMouseDown,
    RESIZE_HANDLE_WIDTH,
    cleanupResize,
  }
}

// Column width constraints
export const columnWidthLimit = {
  [UITypes.Attachment]: {
    minWidth: 100,
    maxWidth: Number.POSITIVE_INFINITY,
  },
  [UITypes.Button]: {
    minWidth: 100,
    maxWidth: 320,
  },
} as const

const getColumnWidthLimit = (uidt: keyof typeof columnWidthLimit) => {
  if (uidt in columnWidthLimit) return columnWidthLimit[uidt]
  return { minWidth: 80, maxWidth: Number.POSITIVE_INFINITY }
}

export const normalizeWidth = (col: ColumnType, width: number): number => {
  if (col.uidt) {
    const { minWidth, maxWidth } = getColumnWidthLimit(col.uidt as keyof typeof columnWidthLimit)
    return Math.min(Math.max(width, minWidth), maxWidth)
  }
  return width
}

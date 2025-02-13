import { type ColumnType, UITypes } from 'nocodb-sdk'

interface Column {
  id: string
  width: string
  [key: string]: any
}

export function useColumnResize(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  columns: ComputedRef<Column[]>,
  colSlice: Ref<{ start: number; end: number }>,
  scrollLeft: Ref<number>,
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

  const setCursor = (type: 'default' | 'col-resize') => {
    document.body.style.cursor = type
  }

  const handleMouseLeave = () => {
    if (!isResizing.value) {
      setCursor('default')
      mousePosition.value = null
    }
  }

  const resizeableColumn = computed(() => {
    if (!mousePosition.value || mousePosition.value.y > 32) {
      if (!isResizing.value) document.body.style.cursor = 'default'
      return null
    }

    const fixedCols = columns.value.filter((col) => col.fixed)
    let currentX = 0

    // Check fixed columns first
    for (const column of fixedCols) {
      const width = parseInt(column.width, 10)
      const nextX = currentX + width

      if (Math.abs(mousePosition.value.x - nextX) <= RESIZE_HANDLE_WIDTH / 2) {
        return { id: column.id, width, x: currentX }
      }
      currentX = nextX
    }

    // Check visible columns
    let accumulatedWidth = 0
    for (let i = 0; i < colSlice.value.start; i++) {
      accumulatedWidth += parseInt(columns.value[i].width, 10)
    }

    currentX = accumulatedWidth - scrollLeft.value
    for (let i = colSlice.value.start; i < colSlice.value.end; i++) {
      const column = columns.value[i]
      const width = parseInt(column.width, 10)
      const nextX = currentX + width

      if (Math.abs(mousePosition.value.x - nextX) <= RESIZE_HANDLE_WIDTH / 2) {
        return { id: column.id, width, x: currentX }
      }
      currentX = nextX
    }

    if (!isResizing.value) document.body.style.cursor = 'default'
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
    setCursor('default')

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    window.removeEventListener('mouseleave', handleMouseLeave)
  }

  const handleMouseDown = (e: MouseEvent) => {
    const column = resizeableColumn.value
    if (!column) return

    isResizing.value = true
    activeColumn.value = {
      id: column.id,
      initialWidth: column.width,
      startX: mousePosition.value?.x || 0,
    }

    setCursor('col-resize')

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('mouseleave', handleMouseLeave)
  }

  function handleMouseUp() {
    if (!isResizing.value || !activeColumn.value || !mousePosition.value) return
    const delta = mousePosition.value.x - activeColumn.value.startX
    const newWidth = Math.max(50, activeColumn.value.initialWidth + delta)
    onResizeEnd?.(activeColumn.value?.id, newWidth)

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
    minWidth: 80,
    maxWidth: Number.POSITIVE_INFINITY,
  },
  [UITypes.Button]: {
    minWidth: 100,
    maxWidth: 320,
  },
}

export const normalizeWidth = (col: ColumnType, width: number) => {
  if (col.uidt! in columnWidthLimit) {
    const { minWidth, maxWidth } = columnWidthLimit[col.uidt]
    if (minWidth < width && width < maxWidth) return width
    if (width < minWidth) return minWidth
    if (width > maxWidth) return maxWidth
  }
  return width
}

interface Column {
  id: string
  width: string
  [key: string]: any
}

export function useColumnResize(
  canvasRef: Ref<HTMLCanvasElement | undefined>,
  columns: Ref<Column[]>,
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
    if (!mousePosition.value || mousePosition.value.y > 32) {
      document.body.style.cursor = 'default'
      return null
    }

    let currentX = 0
    for (const column of columns.value) {
      const width = parseInt(column.width, 10)
      const nextX = currentX + width

      // Check if mouse is within resize handle area
      if (Math.abs(mousePosition.value.x - nextX) <= RESIZE_HANDLE_WIDTH / 2) {
        document.body.style.cursor = 'col-resize'
        return {
          id: column.id,
          width,
          x: currentX,
        }
      }

      currentX = nextX
    }
    document.body.style.cursor = 'default'
    return null
  })

  const handleMouseMove = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    mousePosition.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }

    if (isResizing.value && activeColumn.value) {
      document.body.style.cursor = 'col-resize'
      const delta = mousePosition.value.x - activeColumn.value.startX
      const newWidth = Math.max(50, activeColumn.value.initialWidth + delta)

      onResize?.(activeColumn.value.id, newWidth)
    }
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

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  function handleMouseUp() {
    if (!activeColumn.value || !mousePosition.value) return
    const delta = mousePosition.value.x - activeColumn.value.startX
    const newWidth = Math.max(50, activeColumn.value.initialWidth + delta)
    onResizeEnd?.(activeColumn.value?.id, newWidth)

    isResizing.value = false
    activeColumn.value = null
    document.body.style.cursor = 'default'

    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }

  const showResizeHandle = computed(() => {
    return !isResizing.value && resizeableColumn.value !== null
  })

  const drawResizeHandle = (ctx: CanvasRenderingContext2D) => {
    const column = resizeableColumn.value
    if (!showResizeHandle.value || !column) return

    // ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
    // ctx.fillRect(column.x + column.width - RESIZE_HANDLE_WIDTH / 2, 0, RESIZE_HANDLE_WIDTH, 32)
  }

  onBeforeUnmount(() => {
    document.body.style.cursor = 'default'
  })

  return {
    isResizing,
    activeColumn,
    resizeableColumn,
    showResizeHandle,
    drawResizeHandle,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    RESIZE_HANDLE_WIDTH,
  }
}

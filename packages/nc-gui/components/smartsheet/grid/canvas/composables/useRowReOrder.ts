export function useRowReorder({
  isDragging,
  draggedRowIndex,
  targetRowIndex,
  canvasRef,
  rowHeight,
  cachedRows,
  partialRowHeight,
  scrollTop,
  updateRecordOrder,
  triggerRefreshCanvas,
  totalRows,
  scrollToCell,
}: {
  isDragging: Ref<boolean>
  draggedRowIndex: Ref<number | null>
  targetRowIndex: Ref<number | null>
  canvasRef: Ref<HTMLCanvasElement>
  rowHeight: Ref<number>
  partialRowHeight: Ref<number>
  cachedRows: Ref<Map<number, Row>>
  scrollTop: Ref<number>
  totalRows: Ref<number>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  triggerRefreshCanvas: () => void
  scrollToCell: (row?: number, column?: number) => void
}) {
  const dragStartY = ref(0)
  const currentDragY = ref(0)

  const findRowFromPosition = (y: number): number => {
    const mouseTop = y + scrollTop.value - 32 + partialRowHeight.value
    return Math.max(0, Math.min(Math.round(mouseTop / rowHeight.value), totalRows.value + 1))
  }

  const handleDragStart = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const rowIndex = findRowFromPosition(e.clientY - rect.top) - 1
    const row = cachedRows.value.get(rowIndex)
    if (!row) return

    row.rowMeta.isDragging = true
    cachedRows.value.set(rowIndex, row)
    isDragging.value = true
    draggedRowIndex.value = rowIndex
    targetRowIndex.value = rowIndex + 1
    dragStartY.value = e.clientY
    currentDragY.value = e.clientY

    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleDragEnd)
  }

  function handleDrag(e: MouseEvent) {
    currentDragY.value = e.clientY
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    targetRowIndex.value = findRowFromPosition(e.clientY - rect.top)
    triggerRefreshCanvas()

    const edgeThreshold = 100
    const mouseY = e.clientY - rect.top

    if (mouseY < edgeThreshold) {
      scrollToCell(Math.max(0, targetRowIndex.value - 2), 0)
    } else if (mouseY > rect.height - edgeThreshold) {
      scrollToCell(Math.min(totalRows.value - 1, targetRowIndex.value + 2), 0)
    }
  }
  async function handleDragEnd() {
    if (draggedRowIndex.value !== null && draggedRowIndex.value + 1 !== targetRowIndex.value) {
      await updateRecordOrder(draggedRowIndex.value, targetRowIndex.value === totalRows.value ? null : targetRowIndex.value)
    }
    cleanup()
  }

  function cleanup() {
    isDragging.value = false
    draggedRowIndex.value = null
    targetRowIndex.value = null
    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', handleDragEnd)
    triggerRefreshCanvas()
  }

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    handleDragStart,
  }
}

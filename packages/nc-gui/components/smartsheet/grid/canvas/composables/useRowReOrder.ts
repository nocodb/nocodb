import type { CanvasElement } from '../utils/CanvasElement'

export function useRowReorder({
  isDragging,
  draggedRowGroupPath,
  draggedRowIndex,
  targetRowIndex,
  canvasRef,
  rowHeight,
  updateRecordOrder,
  triggerRefreshCanvas,
  scrollToCell,
  elementMap,
  getDataCache,
}: {
  isDragging: Ref<boolean>
  draggedRowIndex: Ref<number | null>
  draggedRowGroupPath: Ref<number[] | null>
  targetRowIndex: Ref<number | null>
  canvasRef: Ref<HTMLCanvasElement>
  rowHeight: Ref<number>
  partialRowHeight: Ref<number>
  cachedRows: Ref<Map<number, Row>>
  scrollTop: Ref<number>
  totalRows: Ref<number>
  updateRecordOrder: (
    originalIndex: number,
    targetIndex: number | null,
    undo?: boolean,
    isFailed?: boolean,
    path?: Array<number> | null,
  ) => Promise<void>
  triggerRefreshCanvas: () => void
  scrollToCell: (row?: number, column?: number, path?: Array<number>) => void
  elementMap: CanvasElement
  getDataCache: (path?: Array<number> | null) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
}) {
  const dragStartY = ref(0)
  const currentDragY = ref(0)

  const findElement = (x: number, y: number) => {
    const mouseTop = y

    const element = elementMap.findElementAt(x, mouseTop)

    if (element?.isRow || element?.isAddNewRow) {
      return element
    }
  }

  const handleDragStart = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const element = findElement(e.clientX - rect.left, e.clientY - rect.top)

    if (!element) return

    const { cachedRows } = getDataCache(element.groupPath)

    const rowIndex = element.rowIndex

    const row = cachedRows.value.get(rowIndex)

    if (!row) {
      return
    }

    row.rowMeta.isDragging = true
    cachedRows.value.set(rowIndex, row)
    isDragging.value = true
    draggedRowIndex.value = rowIndex
    targetRowIndex.value = rowIndex + 1
    dragStartY.value = e.clientY
    currentDragY.value = e.clientY
    draggedRowGroupPath.value = element.groupPath

    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleDragEnd)
  }

  function handleDrag(e: MouseEvent) {
    currentDragY.value = e.clientY
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const targetElement = findElement(e.clientX - rect.left, e.clientY - rect.top + rowHeight.value / 2)

    if (!targetElement) return

    if (targetElement.groupPath?.join('-') !== draggedRowGroupPath.value?.join('-')) {
      return
    }

    const { totalRows } = getDataCache(targetElement.groupPath)

    targetRowIndex.value = targetElement.rowIndex ?? totalRows.value

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
      const { totalRows } = getDataCache(draggedRowGroupPath.value)
      await updateRecordOrder(
        draggedRowIndex.value,
        targetRowIndex.value === totalRows.value ? null : targetRowIndex.value,
        undefined,
        undefined,
        draggedRowGroupPath.value,
      )
    }
    cleanup()
  }

  function cleanup() {
    isDragging.value = false
    draggedRowIndex.value = null
    targetRowIndex.value = null
    draggedRowGroupPath.value = null
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

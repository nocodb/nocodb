import type { CanvasElement, CanvasElementItem } from '../utils/CanvasElement'
import { comparePath, findGroupByPath, generateGroupPath } from '../utils/groupby'

export interface RowDropTarget {
  path: number[]
  group: CanvasGroup
  patch?: Record<string, any>
  changedLevel?: number
  blockedMessage?: string
}

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
  cachedGroups,
  rowDropTarget,
  canReorderWithinGroup,
  isGroupMoveEnabled,
  resolveDropTarget,
  moveRowToGroup,
  scrollVerticallyBy,
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
    isFailed?: boolean,
    path?: Array<number> | null,
  ) => Promise<void>
  triggerRefreshCanvas: () => void
  scrollToCell: CanvasScrollToCellFn
  elementMap: CanvasElement
  getDataCache: (path?: Array<number> | null) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
  cachedGroups: Ref<Map<number, CanvasGroup>>
  rowDropTarget: Ref<RowDropTarget | null>
  canReorderWithinGroup: ComputedRef<boolean>
  isGroupMoveEnabled: ComputedRef<boolean>
  resolveDropTarget: (sourcePath: number[], target: CanvasGroup) => Omit<RowDropTarget, 'path' | 'group'> | null
  moveRowToGroup: (params: { row: Row; path: number[]; patch: Record<string, any>; changedLevel: number }) => Promise<void>
  scrollVerticallyBy: (delta: number) => void
}) {
  const dragStartY = ref(0)
  const currentDragY = ref(0)

  const findElement = (x: number, y: number) => {
    const mouseTop = y

    const element = elementMap.findElementAt(x, mouseTop)

    if (element?.isRow || element?.isAddNewRow || (element?.isGroup && isGroupMoveEnabled.value)) {
      return element
    }
  }

  function getTargetGroup(element: CanvasElementItem) {
    if (element.isGroup) return element.group
    return element.group ?? findGroupByPath(cachedGroups.value, element.groupPath)
  }

  function updateCrossGroupTarget(element: CanvasElementItem) {
    const group = getTargetGroup(element)
    const sourcePath = draggedRowGroupPath.value ?? []
    const result = group ? resolveDropTarget(sourcePath, group) : null

    targetRowIndex.value = null
    rowDropTarget.value = group && result ? { path: generateGroupPath(group), group, ...result } : null
  }

  const handleDragStart = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const element = findElement(e.clientX - rect.left, e.clientY - rect.top)

    if (!element || element.isGroup) return

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
    targetRowIndex.value = canReorderWithinGroup.value ? rowIndex + 1 : null
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

    const { totalRows } = getDataCache(targetElement.groupPath)

    if (!targetElement.isGroup && comparePath(targetElement.groupPath, draggedRowGroupPath.value)) {
      rowDropTarget.value = null
      targetRowIndex.value = canReorderWithinGroup.value ? targetElement.rowIndex ?? totalRows.value : null
    } else if (isGroupMoveEnabled.value) {
      updateCrossGroupTarget(targetElement)
    } else {
      return
    }

    triggerRefreshCanvas()

    const edgeThreshold = 100
    const mouseY = e.clientY - rect.top

    if (draggedRowGroupPath.value?.length) {
      if (mouseY < edgeThreshold) {
        scrollVerticallyBy(-rowHeight.value)
      } else if (mouseY > rect.height - edgeThreshold) {
        scrollVerticallyBy(rowHeight.value)
      }
      return
    }

    if (targetRowIndex.value === null) return

    if (mouseY < edgeThreshold) {
      scrollToCell(Math.max(0, targetRowIndex.value - 2), 0)
    } else if (mouseY > rect.height - edgeThreshold) {
      scrollToCell(Math.min(totalRows.value - 1, targetRowIndex.value + 2), 0)
    }
  }
  async function handleDragEnd() {
    const dropTarget = rowDropTarget.value
    const sourcePath = draggedRowGroupPath.value ?? []

    if (dropTarget?.patch && dropTarget.changedLevel !== undefined && draggedRowIndex.value !== null) {
      const row = getDataCache(sourcePath).cachedRows.value.get(draggedRowIndex.value)
      cleanup()
      if (row) {
        await moveRowToGroup({ row, path: sourcePath, patch: dropTarget.patch, changedLevel: dropTarget.changedLevel })
      }
      return
    }

    if (draggedRowIndex.value !== null && targetRowIndex.value !== null && draggedRowIndex.value + 1 !== targetRowIndex.value) {
      const { totalRows } = getDataCache(sourcePath)
      await updateRecordOrder(
        draggedRowIndex.value,
        targetRowIndex.value === totalRows.value ? null : targetRowIndex.value,
        undefined,
        sourcePath,
      )
    }
    cleanup()
  }

  function cleanup() {
    isDragging.value = false
    draggedRowIndex.value = null
    targetRowIndex.value = null
    draggedRowGroupPath.value = null
    rowDropTarget.value = null
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

import type { CanvasElement, CanvasElementItem } from '../utils/CanvasElement'
import { comparePath, findGroupByPath, generateGroupPath } from '../utils/groupby'

export interface RowDropTarget {
  path: number[]
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
  resolveDropTarget: (sourcePath: number[], target: CanvasGroup) => Omit<RowDropTarget, 'path'> | null
  moveRowToGroup?: (params: {
    row: Row
    path: number[]
    targetPath: number[]
    patch: Record<string, any>
    changedLevel: number
  }) => Promise<void>
  scrollVerticallyBy: (delta: number) => void
}) {
  const { t } = useI18n()

  const dragStartY = ref(0)
  const currentDragY = ref(0)

  // Held by reference: a group refresh during the drag can shift indices, so the drop must not re-read by index.
  let draggedRow: Row | null = null

  let isMoveInFlight = false

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
    targetRowIndex.value = null

    if (!group) {
      rowDropTarget.value = null
      return
    }

    const path = generateGroupPath(group)
    // mousemove fires far more often than the hovered group changes
    if (rowDropTarget.value && comparePath(rowDropTarget.value.path, path)) return

    const result = resolveDropTarget(draggedRowGroupPath.value ?? [], group)
    rowDropTarget.value = result ? { path, ...result } : null
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopImmediatePropagation()
    cleanup()
  }

  // The dragged row is still at its drag-start slot, so the drop acts on the record that was picked up.
  function isDraggedRowInPlace(sourcePath: number[]) {
    return !!draggedRow && getDataCache(sourcePath).cachedRows.value.get(draggedRowIndex.value!) === draggedRow
  }

  const handleDragStart = (e: MouseEvent) => {
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const element = findElement(e.clientX - rect.left, e.clientY - rect.top)

    if (!element || element.isGroup || isMoveInFlight) return

    const { cachedRows } = getDataCache(element.groupPath)

    const rowIndex = element.rowIndex

    const row = cachedRows.value.get(rowIndex)

    if (!row) {
      return
    }

    row.rowMeta.isDragging = true
    cachedRows.value.set(rowIndex, row)
    draggedRow = row
    isDragging.value = true
    draggedRowIndex.value = rowIndex
    targetRowIndex.value = canReorderWithinGroup.value ? rowIndex + 1 : null
    dragStartY.value = e.clientY
    currentDragY.value = e.clientY
    draggedRowGroupPath.value = element.groupPath

    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', handleDragEnd)
    window.addEventListener('keydown', onKeyDown, true)
  }

  function handleDrag(e: MouseEvent) {
    currentDragY.value = e.clientY
    const rect = canvasRef.value?.getBoundingClientRect()
    if (!rect) return

    const isInsideCanvas = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom

    const targetElement = isInsideCanvas
      ? findElement(e.clientX - rect.left, e.clientY - rect.top + rowHeight.value / 2)
      : undefined

    if (!targetElement) {
      // Releasing over a gap or outside the grid must not move the record to the last hovered group.
      if (rowDropTarget.value) {
        rowDropTarget.value = null
        triggerRefreshCanvas()
      }
      return
    }

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
    const row = draggedRow

    if (!isDraggedRowInPlace(sourcePath)) {
      if (dropTarget?.patch) message.info(t('msg.info.groupMoveCancelledRowChanged'))
      cleanup()
      return
    }

    if (row && dropTarget?.patch && dropTarget.changedLevel !== undefined && moveRowToGroup) {
      cleanup()
      isMoveInFlight = true
      try {
        await moveRowToGroup({
          row,
          path: sourcePath,
          targetPath: dropTarget.path,
          patch: dropTarget.patch,
          changedLevel: dropTarget.changedLevel,
        })
      } finally {
        isMoveInFlight = false
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
    if (draggedRow) draggedRow.rowMeta.isDragging = false
    draggedRow = null
    isDragging.value = false
    draggedRowIndex.value = null
    targetRowIndex.value = null
    draggedRowGroupPath.value = null
    rowDropTarget.value = null
    window.removeEventListener('mousemove', handleDrag)
    window.removeEventListener('mouseup', handleDragEnd)
    window.removeEventListener('keydown', onKeyDown, true)
    triggerRefreshCanvas()
  }

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    handleDragStart,
  }
}

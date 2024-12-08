import { type Ref, ref } from 'vue'
import type { Row } from '../../../lib/types'

export const useRowDragging = ({
  updateRecordOrder,
  gridWrapper,
  onDragStart,
}: {
  gridWrapper: Ref<HTMLElement | undefined>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  onDragStart?: (row: Row, e: MouseEvent) => void
}) => {
  const dragging = ref(false)
  const dragRow = ref<Row | null>(null)
  const dragIndex = ref<number | null>(null)
  const targetRow = ref<Row | null>(null)
  const targetIndex = ref<number | null>(null)
  const lastHoverIndex = ref<number | null>(null)
  const insertAtEnd = ref(false)

  const isAutoScrolling = ref(false)
  let moveHandler: ((e: MouseEvent) => void) | null = null
  let upHandler: ((e: MouseEvent) => void) | null = null
  let keyHandler: ((e: KeyboardEvent) => void) | null = null
  let rafId: number | null = null
  let lastEvent: MouseEvent | null = null

  const cleanup = () => {
    if (moveHandler) window.removeEventListener('mousemove', moveHandler)
    if (upHandler) window.removeEventListener('mouseup', upHandler)
    if (keyHandler) document.body.removeEventListener('keydown', keyHandler)
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isAutoScrolling.value = false
    lastEvent = null

    moveHandler = null
    upHandler = null
    keyHandler = null
  }

  const cancel = () => {
    dragging.value = false
    dragRow.value = null
    dragIndex.value = null
    targetRow.value = null
    targetIndex.value = null
    lastHoverIndex.value = null
    insertAtEnd.value = false

    if (gridWrapper.value) {
      gridWrapper.value.style.cursor = ''
    }

    cleanup()
  }

  const onHover = (hoverRow: Row | null | 'end', isAbove?: boolean) => {
    if (!dragging.value) return

    if (hoverRow === 'end') {
      if (targetRow.value?.rowMeta.rowIndex === null && insertAtEnd.value) return
      lastHoverIndex.value = targetIndex.value
      targetRow.value = null
      targetIndex.value = null
      insertAtEnd.value = true
      return
    }

    if (!hoverRow) {
      if (isAbove && targetIndex.value === 0) return
      if (isAbove) {
        lastHoverIndex.value = targetIndex.value
        targetRow.value = null
        targetIndex.value = 0
        insertAtEnd.value = false
        return
      }
      return
    }

    insertAtEnd.value = false

    if (targetRow.value?.rowMeta.rowIndex === hoverRow.rowMeta.rowIndex) return

    lastHoverIndex.value = targetIndex.value
    targetRow.value = hoverRow
    targetIndex.value = hoverRow.rowMeta.rowIndex ?? null
  }

  const checkAndScroll = () => {
    if (!dragging.value || !gridWrapper.value || !lastEvent) return

    const element = gridWrapper.value
    const rect = element.getBoundingClientRect()
    const threshold = Math.min(rect.height * 0.2, 150)

    const mouseTop = lastEvent.clientY - rect.top
    const mouseBottom = rect.height - mouseTop

    if (lastEvent.clientY < rect.top) {
      onHover(null, true)
    }

    let scrollDelta = 0

    if (mouseTop < threshold) {
      scrollDelta = -Math.ceil(25 * (1 - mouseTop / threshold))
    } else if (mouseBottom < threshold) {
      scrollDelta = Math.ceil(25 * (1 - mouseBottom / threshold))
    }

    if (scrollDelta !== 0) {
      isAutoScrolling.value = true
      const newScrollTop = Math.max(0, element.scrollTop + scrollDelta)
      element.scrollTo({
        top: newScrollTop,
        behavior: 'auto',
      })
      rafId = requestAnimationFrame(checkAndScroll)
    } else {
      isAutoScrolling.value = false
    }
  }

  const handleMove = (event: MouseEvent) => {
    if (!dragging.value || !gridWrapper.value) return
    event.preventDefault()

    lastEvent = event

    if (!isAutoScrolling.value) {
      checkAndScroll()
    }
  }

  const startDragging = (row: Row, e: MouseEvent) => {
    if (!gridWrapper.value || row.rowMeta.rowIndex == null) return

    onDragStart?.(row, e)

    dragging.value = true
    dragRow.value = row
    dragIndex.value = row.rowMeta.rowIndex
    targetRow.value = row
    targetIndex.value = row.rowMeta.rowIndex
    lastHoverIndex.value = row.rowMeta.rowIndex

    if (gridWrapper.value) {
      gridWrapper.value.style.cursor = 'grabbing'
    }

    moveHandler = handleMove
    upHandler = async (e: MouseEvent) => {
      e.preventDefault()

      // Don't update if nothing changed
      if (dragIndex.value === targetIndex.value && !insertAtEnd.value) {
        cancel()
        return
      }

      try {
        await updateRecordOrder(dragIndex.value!, insertAtEnd.value ? 'end' : targetIndex.value)
      } catch (error) {
        console.error('Error updating record order:', error)
      } finally {
        cancel()
      }
    }

    keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }

    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
    document.body.addEventListener('keydown', keyHandler)

    handleMove(e)
  }

  return {
    isDragging: dragging,
    dragRow,
    dragIndex,
    targetRow,
    targetIndex,
    insertAtEnd,
    lastHoverIndex,
    startDragging,
    cancel,
    onHover,
  }
}

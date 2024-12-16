import { ref } from 'vue'
import type { ComputedRef, type Ref } from 'vue'
import type { Row } from '~/lib/types'

export const useRowDragging = ({
  updateRecordOrder,
  gridWrapper,
  virtualMargin,
  rowSlice,
  rowHeight,
  totalRows,
  cachedRows,
}: {
  gridWrapper: Ref<HTMLElement | undefined>
  updateRecordOrder: (originalIndex: number, targetIndex: number | null) => Promise<void>
  onDragStart?: (row: Row, e: MouseEvent) => void
  rowHeight: ComputedRef<number>
  rowSlice: { start: number; end: number }
  totalRows: Ref<number>
  cachedRows: Ref<Map<number, Row>>
  virtualMargin: number
}) => {
  const isDragging = ref(false)

  const row = ref<null | Row>(null)

  const startRowTop = ref(0)

  const targetRow = ref<null | Row>(null)

  const mouseStart = ref(0)

  const draggingTop = ref(0)

  const targetTop = ref(0)

  const lastMoveEvent = ref<null | MouseEvent>(null)

  const autoScrolling = ref(false)

  const scrollTimeout = ref<null | ReturnType<typeof setTimeout>>(null)

  const moveHandler = (event: MouseEvent, startAutoScroll = false) => {
    if (event !== null) {
      event.preventDefault()
      lastMoveEvent.value = event
    } else {
      event = lastMoveEvent.value
    }

    if (!gridWrapper.value) return

    const gridWrapperRect = gridWrapper.value.getBoundingClientRect()
    const gridWrapperHeight = gridWrapperRect.bottom - gridWrapperRect.top

    draggingTop.value = Math.max(
      0,
      Math.min(startRowTop.value + event.clientY - mouseStart.value, gridWrapperHeight - rowHeight.value),
    )

    const mouseTop = event.clientY - gridWrapperRect.top + gridWrapper.value.scrollTop
    const rowIndex = Math.max(0, Math.min(Math.round(mouseTop / rowHeight.value), totalRows.value + 1))

    const visibleStart = Math.max(0, rowSlice.start - virtualMargin)
    const adjustedRowIndex = Math.max(visibleStart, Math.min(rowIndex, rowSlice.end + virtualMargin))

    targetTop.value = adjustedRowIndex * rowHeight.value

    const beforeRowIndex = rowIndex - rowSlice.start - 1

    if (!autoScrolling.value || !startAutoScroll) {
      const side = Math.ceil((gridWrapperHeight / 100) * 10)
      const autoScrollMouseTop = event.clientY - gridWrapperRect.top
      const autoScrollMouseBottom = gridWrapperHeight - autoScrollMouseTop

      let speed = 0

      // Check if we can scroll further in the respective direction
      const canScrollUp = gridWrapper.value.scrollTop > 0
      const canScrollDown = gridWrapper.value.scrollTop < gridWrapper.value.scrollHeight - gridWrapperHeight

      if (autoScrollMouseTop < side && canScrollUp) {
        speed = -(6 - Math.ceil((Math.max(0, autoScrollMouseTop) / side) * 6))
      } else if (autoScrollMouseBottom < side && canScrollDown) {
        speed = 6 - Math.ceil((Math.max(0, autoScrollMouseBottom) / side) * 6)
      }

      if (speed !== 0) {
        const newScrollTop = gridWrapper.value.scrollTop + speed

        // Check if the new scroll position would be within bounds
        if (newScrollTop >= 0 && newScrollTop <= gridWrapper.value.scrollHeight - gridWrapperHeight) {
          autoScrolling.value = true
          gridWrapper.value.scrollTop = newScrollTop

          // Clear any existing timeout before setting a new one
          if (scrollTimeout.value) {
            clearTimeout(scrollTimeout.value)
          }

          scrollTimeout.value = setTimeout(() => {
            moveHandler(null, false)
          }, 16)
        } else {
          autoScrolling.value = false
        }
      } else {
        autoScrolling.value = false
        if (scrollTimeout.value) {
          clearTimeout(scrollTimeout.value)
        }
      }
    }

    targetRow.value = cachedRows.value.get(rowSlice.start + beforeRowIndex)
  }

  const mouseUp = async (event: MouseEvent) => {
    event.preventDefault()
    cancel()

    await updateRecordOrder(row.value.rowMeta.rowIndex!, targetRow.value ? targetRow.value.rowMeta.rowIndex : null)

    row.value = null
    targetRow.value = null
  }

  function cancel(): void {
    isDragging.value = false
    autoScrolling.value = false
    window.removeEventListener('mousemove', moveHandler)
    window.removeEventListener('mouseup', mouseUp)
  }

  const getRowTop = (rowIndex: number) => {
    return rowIndex * rowHeight.value
  }

  const startDragging = (_row: Row, event: MouseEvent) => {
    row.value = _row

    startRowTop.value = getRowTop(_row.rowMeta.rowIndex) - (gridWrapper.value?.scrollTop || 0)

    mouseStart.value = event.clientY

    draggingTop.value = 0

    targetTop.value = 0

    targetRow.value = null

    moveHandler(event)

    isDragging.value = true

    window.addEventListener('mousemove', moveHandler)

    window.addEventListener('mouseup', mouseUp)
  }

  return {
    startDragging,
    draggingRecord: row,
    cancel,
    isDragging,
    targetTop,
  }
}

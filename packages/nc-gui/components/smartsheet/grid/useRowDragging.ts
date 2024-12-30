import type { ComputedRef, Ref } from 'vue'
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
  const targetTop = ref(32)
  const lastMoveEvent = ref<null | MouseEvent>(null)
  const autoScrolling = ref(false)
  const animationFrameId = ref<number | null>(null)

  const moveHandler = (event: MouseEvent | null, startAutoScroll = false) => {
    try {
      if (event !== null) {
        event.preventDefault()
        lastMoveEvent.value = event
      } else {
        event = lastMoveEvent.value
      }

      if (!gridWrapper.value || !event) return

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

      targetTop.value = Math.max(adjustedRowIndex * rowHeight.value, 32)

      const beforeRowIndex = rowIndex - rowSlice.start - 1

      if (!autoScrolling.value || !startAutoScroll) {
        const side = Math.ceil((gridWrapperHeight / 100) * 10)
        const autoScrollMouseTop = event.clientY - gridWrapperRect.top
        const autoScrollMouseBottom = gridWrapperHeight - autoScrollMouseTop

        let speed = 0

        const canScrollUp = gridWrapper.value.scrollTop > 0
        const canScrollDown = gridWrapper.value.scrollTop < gridWrapper.value.scrollHeight - gridWrapperHeight

        if (autoScrollMouseTop < side && canScrollUp) {
          speed = -(6 - Math.ceil((Math.max(0, autoScrollMouseTop) / side) * 6))
        } else if (autoScrollMouseBottom < side && canScrollDown) {
          speed = 6 - Math.ceil((Math.max(0, autoScrollMouseBottom) / side) * 6)
        }

        if (speed !== 0) {
          const newScrollTop = gridWrapper.value.scrollTop + speed

          if (newScrollTop >= 0 && newScrollTop <= gridWrapper.value.scrollHeight - gridWrapperHeight) {
            autoScrolling.value = true
            gridWrapper.value.scrollTop = newScrollTop

            if (animationFrameId.value !== null) {
              cancelAnimationFrame(animationFrameId.value)
            }
            animationFrameId.value = requestAnimationFrame(() => {
              moveHandler(null, false)
            })
          } else {
            autoScrolling.value = false
          }
        } else {
          autoScrolling.value = false
          if (animationFrameId.value !== null) {
            cancelAnimationFrame(animationFrameId.value)
            animationFrameId.value = null
          }
        }
      }

      targetRow.value = cachedRows.value.get(Math.max(rowSlice.start + beforeRowIndex, 0))
    } catch (error) {
      console.error('Error in moveHandler:', error)
      cancel()
    }
  }

  const mouseUp = async (event: MouseEvent) => {
    try {
      event.preventDefault()
      cancel()

      if (row.value && row.value.rowMeta.rowIndex !== undefined) {
        await updateRecordOrder(row.value.rowMeta.rowIndex, targetRow.value ? targetRow.value.rowMeta.rowIndex : null)
      }

      row.value = null
      targetRow.value = null
    } catch (error) {
      console.error('Error in mouseUp:', error)
      cancel()
    }
  }

  function cancel(): void {
    try {
      isDragging.value = false
      autoScrolling.value = false

      if (animationFrameId.value !== null) {
        cancelAnimationFrame(animationFrameId.value)
        animationFrameId.value = null
      }

      window.removeEventListener('mousemove', moveHandler)
      window.removeEventListener('mouseup', mouseUp)
    } catch (error) {
      console.error('Error in cancel:', error)
    }
  }

  const getRowTop = (rowIndex: number) => {
    return rowIndex * rowHeight.value
  }

  const startDragging = (_row: Row, event: MouseEvent) => {
    try {
      row.value = _row
      startRowTop.value = getRowTop(_row.rowMeta.rowIndex) - (gridWrapper.value?.scrollTop || 0)
      mouseStart.value = event.clientY
      draggingTop.value = 32
      targetTop.value = 32
      targetRow.value = null

      // Add opacity effect immediately when starting to drag
      isDragging.value = true

      moveHandler(event)

      window.addEventListener('mousemove', moveHandler)
      window.addEventListener('mouseup', mouseUp)
    } catch (error) {
      console.error('Error in startDragging:', error)
      cancel()
    }
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    cancel()
  })

  return {
    startDragging,
    draggingRecord: row,
    cancel,
    isDragging,
    targetTop,
  }
}

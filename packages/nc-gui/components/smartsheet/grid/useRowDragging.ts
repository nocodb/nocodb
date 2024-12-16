import { type Ref, ref } from 'vue'
import type { GridItem } from '~/lib/types'

interface DragConfig {
  containerRef: Ref<HTMLElement | undefined>
  reorderItems: (fromIndex: number, toIndex: number | null) => Promise<void>
  onInitiateDrag?: (item: GridItem, evt: MouseEvent) => void
  itemHeight: Ref<number>
  visibleRange: { first: number; last: number }
  itemCount: Ref<number>
  itemCache: Ref<Map<number, GridItem>>
}

export const useRowDragging = ({
  containerRef,
  reorderItems,
  onInitiateDrag,
  itemHeight,
  visibleRange,
  itemCount,
  itemCache,
}: DragConfig) => {
  const isActive = ref(false)
  const activeItem = ref<null | GridItem>(null)
  const initialY = ref(0)
  const basePosition = ref(0)
  const dropTarget = ref<null | GridItem>(null)
  const pointerStart = ref(0)
  const currentY = ref(0)
  const dropZoneY = ref(0)
  const lastPointer = ref<null | MouseEvent>(null)
  const isScrolling = ref(false)

  const handlePointerMove = (evt: MouseEvent, initScroll = false) => {
    if (evt !== null) {
      evt.preventDefault()
      lastPointer.value = evt
    } else {
      evt = lastPointer.value
    }

    const bounds = containerRef.value.getBoundingClientRect()
    const containerHeight = bounds.height

    currentY.value = Math.max(
      0,
      Math.min(basePosition.value + evt.clientY - pointerStart.value, containerHeight - itemHeight.value),
    )

    const relativeY = evt.clientY - bounds.top + containerRef.value.scrollTop
    const targetIndex = Math.max(0, Math.min(Math.round(relativeY / itemHeight.value), itemCount.value))
    dropZoneY.value = targetIndex * itemHeight.value - containerRef.value.scrollTop

    if (!isScrolling.value || !initScroll) {
      const scrollZone = Math.ceil(containerHeight / 10)
      const mouseY = evt.clientY - bounds.top
      const distanceFromBottom = containerHeight - mouseY

      let velocity = 0

      if (mouseY < scrollZone) {
        velocity = -(6 - Math.ceil((Math.max(0, mouseY) / scrollZone) * 6))
      } else if (distanceFromBottom < scrollZone) {
        velocity = 6 - Math.ceil((Math.max(0, distanceFromBottom) / scrollZone) * 6)
      }

      if (velocity !== 0) {
        isScrolling.value = true
        containerRef.value.scrollTop += velocity
        containerRef.value.scrollTimeout = setTimeout(() => handlePointerMove(null, false), 1)
      } else {
        isScrolling.value = false
      }
    }

    const targetItemIndex = targetIndex - visibleRange.first - 1
    dropTarget.value = itemCache.value.get(visibleRange.first + targetItemIndex)
  }

  const reset = () => {
    isActive.value = false
    window.removeEventListener('mousemove', handlePointerMove)
    window.removeEventListener('mouseup', handleDrop)
  }

  const handleDrop = async (evt: MouseEvent) => {
    evt.preventDefault()
    reset()
    await reorderItems(activeItem.value.itemMeta.index, dropTarget.value.itemMeta.index)
    activeItem.value = null
    dropTarget.value = null
  }

  const calculateY = (index: number) => {
    return index * itemHeight.value
  }

  const initDrag = (item: GridItem, evt: MouseEvent) => {
    activeItem.value = item
    basePosition.value = calculateY(item.itemMeta.index) - containerRef.value.scrollTop
    pointerStart.value = evt.clientY
    currentY.value = 0
    dropZoneY.value = 0
    dropTarget.value = null

    handlePointerMove(evt)
    isActive.value = true

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handleDrop)
  }

  return {
    initDrag,
    activeItem,
    reset,
    isActive,
    dropZoneY,
  }
}

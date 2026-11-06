const EDGE_MARGIN = 16

/**
 * Drag a fixed floating button anywhere on screen. `position.edge` is the distance
 * from the side it docks to (right, or left under RTL), so a dropped button keeps that edge.
 * Until it is dragged `position` stays at -1 and the button keeps its CSS placement.
 */
export function useDraggableFab(options: { onDragEnd?: () => void } = {}) {
  const { isRtl } = useRtl()

  const isDragging = ref(false)

  const position = ref({ edge: -1, y: -1 })

  const style = computed(() => {
    if (position.value.edge < 0 || position.value.y < 0) return {}

    const edge = `${position.value.edge}px`

    return {
      bottom: 'auto',
      top: `${position.value.y}px`,
      ...(isRtl.value ? { left: edge, right: 'auto' } : { right: edge, left: 'auto' }),
    }
  })

  function clampPosition(x: number, y: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - EDGE_MARGIN
    const maxY = window.innerHeight - rect.height - EDGE_MARGIN

    return {
      x: Math.max(EDGE_MARGIN, Math.min(x, maxX)),
      y: Math.max(EDGE_MARGIN, Math.min(y, maxY)),
    }
  }

  function onPointerDown(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY

      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return

      moved = true
      isDragging.value = true

      const clamped = clampPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY, el)

      position.value = {
        edge: isRtl.value ? clamped.x : window.innerWidth - clamped.x - rect.width,
        y: clamped.y,
      }
    }

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)

      if (moved) {
        options.onDragEnd?.()

        // Suppress the click that follows a drag
        setTimeout(() => {
          isDragging.value = false
        }, 0)
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
  }

  return { isDragging, position, style, onPointerDown }
}

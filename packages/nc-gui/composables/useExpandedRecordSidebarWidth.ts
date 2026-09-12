import { createSharedComposable, useStorage } from '@vueuse/core'

/**
 * Width of the right-side drawer (`.nc-comments-drawer`) in the expanded
 * record's Field / File / Discussion presenters. Replaces the previous
 * `w-1/3 max-w-[400px] min-w-[240px]` with a user-resizable value persisted
 * across sessions via localStorage.
 *
 * Used by both the EE docked side panel and the modal, since the presenters
 * are shared between the two surfaces.
 */
export const useExpandedRecordSidebarWidth = createSharedComposable(() => {
  const MIN_WIDTH = 240
  const MAX_WIDTH = 600
  const DEFAULT_WIDTH = 280

  const sidebarWidth = useStorage<number>('nc-expanded-record-sidebar-width', DEFAULT_WIDTH)

  // Guard against stale localStorage values outside the new bounds.
  if (sidebarWidth.value < MIN_WIDTH) sidebarWidth.value = MIN_WIDTH
  if (sidebarWidth.value > MAX_WIDTH) sidebarWidth.value = MAX_WIDTH

  const isResizing = ref(false)
  let startX = 0
  let startWidth = 0

  const onResizeMove = (e: MouseEvent) => {
    if (!isResizing.value) return
    // Sidebar grows when user drags LEFT (toward the main pane); shrinks when
    // dragging RIGHT (toward the panel edge). Hence `startX - e.clientX`.
    const delta = startX - e.clientX
    sidebarWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta))
  }

  const onResizeEnd = () => {
    isResizing.value = false
    document.body.style.cursor = ''
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }

  const onResizeStart = (e: MouseEvent) => {
    isResizing.value = true
    startX = e.clientX
    startWidth = sidebarWidth.value
    document.body.style.cursor = 'col-resize'
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeEnd)
  }

  // Safety net: if the composable's scope is disposed mid-drag (e.g. user
  // hit Esc and closed the form before releasing mouse), tear down the
  // window listeners and reset the cursor — otherwise they'd leak.
  tryOnScopeDispose(() => {
    if (isResizing.value) onResizeEnd()
  })

  return { sidebarWidth, isResizing, onResizeStart, MIN_WIDTH, MAX_WIDTH }
})

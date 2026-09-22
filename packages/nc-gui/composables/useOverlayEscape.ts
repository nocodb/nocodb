/**
 * One owner for Escape among stacked overlays.
 *
 * Ant's dialog closes on Escape from a keydown handler on `.ant-modal-wrap` and
 * calls `stopPropagation()` right there (`vc-dialog/Dialog.js`). A dropdown whose
 * trigger sits inside a modal therefore never sees the key at all — the modal
 * closes out from under it. Listening in the **capture** phase gets in front of
 * that handler, and keeping a stack means only the innermost overlay reacts, so
 * nested dropdowns unwind one press at a time instead of all closing together.
 *
 * Selects are deliberately left alone: `a-select` stops Escape itself, at the
 * field, so it closes only its option list (see the ant-design-vue patch in
 * `.patches/`). Capturing here would take that key away from it.
 */

interface OverlayEscapeEntry {
  id: symbol
  close: () => void
}

/** Innermost last. Module-level: one arbiter for the whole app. */
const overlayStack: OverlayEscapeEntry[] = []

let isListening = false

function isSelectOpen() {
  return !!document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
}

function onCaptureKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !overlayStack.length) return

  if (isSelectOpen()) return

  // Take the key outright: without this the modal wrapper's own handler still
  // runs on the way back up and closes the host as well.
  e.preventDefault()
  e.stopPropagation()

  overlayStack[overlayStack.length - 1]!.close()
}

/**
 * Registers an overlay as Escape's owner while it is open.
 *
 * @param isOpen reactive open state
 * @param close  called on Escape when this overlay is the innermost one open
 */
export function useOverlayEscape(isOpen: Ref<boolean>, close: () => void) {
  const id = Symbol('nc-overlay-escape')

  function remove() {
    const idx = overlayStack.findIndex((entry) => entry.id === id)

    if (idx !== -1) overlayStack.splice(idx, 1)
  }

  watch(
    isOpen,
    (open) => {
      // Re-push rather than reorder: reopening should put this overlay back on
      // top, above anything opened while it was shut.
      remove()

      if (open) overlayStack.push({ id, close })
    },
    { immediate: true },
  )

  onBeforeUnmount(remove)

  if (!isListening && typeof document !== 'undefined') {
    isListening = true

    document.addEventListener('keydown', onCaptureKeydown, true)
  }
}

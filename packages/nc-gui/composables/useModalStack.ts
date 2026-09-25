// Ant gives every modal z-index 1000, so a nested one can land under its parent; this ranks them by open order.
const MODAL_Z_BASE = 1000

// Kept small so body-level popups (dropdowns at 1050, toasts) stay above any realistic depth.
const MODAL_Z_STEP = 1

// Module scope: the stack belongs to the screen, not to one modal.
const stack = ref<symbol[]>([])

// For modals outside the stack (Modal.confirm), so they open above every stacked one.
export const nextModalZIndex = () => MODAL_Z_BASE + stack.value.length * MODAL_Z_STEP

export function useModalStack(isVisible: () => boolean) {
  const token = Symbol('nc-modal')

  const depth = ref(0)

  const zIndex = computed(() => MODAL_Z_BASE + depth.value * MODAL_Z_STEP)

  const isStacked = computed(() => depth.value > 0)

  const push = () => {
    if (stack.value.includes(token)) return

    depth.value = stack.value.length
    stack.value = [...stack.value, token]
  }

  // Depth is left as is so the closing fade keeps its z-index and mask.
  const pop = () => {
    stack.value = stack.value.filter((t) => t !== token)
  }

  watch(isVisible, (isOpen) => (isOpen ? push() : pop()), { immediate: true })

  // A modal unmounted while open (route change, v-if) must still release its slot.
  onBeforeUnmount(pop)

  return { zIndex, isStacked }
}

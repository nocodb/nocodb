/**
 * How many NcModals are open, so one opened on top of another can outrank it.
 *
 * Ant gives every modal the same z-index (1000), which leaves a nested modal's
 * mask *under* the modal it was opened from: the parent stayed fully lit while
 * everything around it dimmed twice.
 *
 * Module scope on purpose. The stack is a property of the screen, not of any one
 * dialog -- and state declared at the top of a `<script setup>` block is
 * per-instance, so it cannot be kept there.
 */
const MODAL_Z_BASE = 1000

const MODAL_Z_STEP = 20

/** Tokens of the modals currently open, innermost last. */
const stack = ref<symbol[]>([])

export function useModalStack() {
  const token = Symbol('nc-modal')

  const depth = ref(0)

  const zIndex = computed(() => MODAL_Z_BASE + depth.value * MODAL_Z_STEP)

  const isStacked = computed(() => depth.value > 0)

  const push = () => {
    if (stack.value.includes(token)) return

    depth.value = stack.value.length
    stack.value = [...stack.value, token]
  }

  const pop = () => {
    if (!stack.value.includes(token)) return

    stack.value = stack.value.filter((t) => t !== token)
    depth.value = 0
  }

  return { depth, zIndex, isStacked, push, pop }
}

import { ref } from 'vue'
import { createEventHook } from '@vueuse/core'

export interface UseDetachedLongTextProps {
  isOpen?: boolean
  column: {
    title: string
  }
  vModel: string
}

const [setup, use] = useInjectionState(() => {
  return ref<UseDetachedLongTextProps[]>([])
})

export { setup as UseDetachedLongTextProvider }

export function useDetachedLongText() {
  let states = use()!

  if (!states) {
    states = setup()
  }

  const closeHook = createEventHook<void>()
  const index = ref(-1)

  const open = (props: UseDetachedLongTextProps) => {
    states.value.push({
      isOpen: true,
      ...props,
    })
    index.value = states.value.length - 1
  }

  const close = (i?: number) => {
    states.value.splice(i || index.value, 1)
    if (index.value === i || !i) closeHook.trigger()
  }

  return { states, open, close, onClose: closeHook.on }
}

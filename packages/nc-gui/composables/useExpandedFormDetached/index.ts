import type { TableType, ViewType } from 'nocodb-sdk'
import { createEventHook, ref, useInjectionState } from '#imports'
import type { Row } from '#imports'

interface UseExpandedFormDetachedProps {
  'isOpen'?: boolean
  'row': Row
  'state'?: Record<string, any> | null
  'meta': TableType
  'loadRow'?: boolean
  'useMetaFields'?: boolean
  'rowId'?: string
  'view'?: ViewType
  'onCancel'?: Function
  'onUpdate:modelValue'?: Function
}

const [setup, use] = useInjectionState(() => {
  return ref<UseExpandedFormDetachedProps[]>([])
})

export function useExpandedFormDetached() {
  let states = use()!

  if (!states) {
    states = setup()
  }

  const closeHook = createEventHook<void>()

  const index = ref(-1)

  const open = (props: UseExpandedFormDetachedProps) => {
    states.value.push(props)
    index.value = states.value.length - 1
  }

  const close = (i?: number) => {
    states.value.splice(i || index.value, 1)
    if (index.value === i || !i) closeHook.trigger()
  }

  return { states, open, close, onClose: closeHook.on }
}

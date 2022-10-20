import type { TableType, ViewType } from 'nocodb-sdk'
import { reactive, toRefs, useInjectionState } from '#imports'
import type { Row } from '~/lib'

interface UseExpandedFormDetachedProps {
  isOpen?: boolean
  row: Row | null
  state?: Record<string, any> | null
  meta: TableType
  loadRow?: boolean
  useMetaFields?: boolean
  rowId?: string
  view?: ViewType
}

const [setup, use] = useInjectionState(() => {
  const state = reactive<UseExpandedFormDetachedProps>({
    isOpen: false,
    state: null,
    loadRow: false,
    useMetaFields: false,
    row: null,
    meta: null as any,
  })

  const open = (props: UseExpandedFormDetachedProps) => {
    state.state = props.state
    state.loadRow = props.loadRow
    state.useMetaFields = props.useMetaFields
    state.rowId = props.rowId
    state.row = props.row
    state.loadRow = props.loadRow
    state.meta = props.meta
    state.isOpen = props.isOpen

    state.isOpen = true
  }

  const close = () => {
    state.isOpen = false
  }

  return {
    ...toRefs(state),
    open,
    close,
  }
})

export function useExpandedFormDetached() {
  const state = use()

  if (!state) {
    return setup()
  }

  return state
}

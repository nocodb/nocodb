import type { TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useInjectionState } from '#imports'
import type { Row } from '~/composables/useViewData'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  // state
  const localState = reactive({})

  // getters
  const isNew = computed(() => row.value?.rowMeta?.new)

  // actions

  return {
    row,
    localState,
    isNew,
  }
}, 'smartsheet-row-store')

export { useProvideSmartsheetRowStore }

export function useSmartsheetRowStoreOrThrow() {
  const smartsheetRowStore = useSmartsheetRowStore()
  if (smartsheetRowStore == null) throw new Error('Please call `useSmartsheetRowStore` on the appropriate parent component')
  return smartsheetRowStore
}

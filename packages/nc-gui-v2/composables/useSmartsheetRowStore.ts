import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useInjectionState } from '#imports'
import type { Row } from '~/composables/useViewData'
import { useVirtualCell } from '~/composables/useVirtualCell'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState((meta: Ref<TableType>, row: Ref<Row>) => {
  // state
  const state = ref<Record<string, Record<string, any> | Record<string, any>[] | null>>({})

  // getters
  const isNew = computed(() => row.value?.rowMeta?.new)

  // actions
  const addLTARRef = async (value: Record<string, any>, column: ColumnType) => {
    const { isHm, isMm } = $(useVirtualCell(ref(column)))
    if (isHm || isMm) {
      state.value[column.title!] = state.value[column.title!] || []
      state.value[column.title!]!.push(value)
    } else {
      state.value[column.title!] = value
    }
  }

  // actions
  const removeLTARRef = async (value: Record<string, any>, column: ColumnType) => {
    const { isHm, isMm } = $(useVirtualCell(ref(column)))
    if (isHm || isMm) {
      state.value[column.title!]?.splice(state.value[column.title!]?.indexOf(value), 1)
    } else {
      state.value[column.title!] = null
    }
  }

  return {
    row,
    state,
    isNew,
    // todo: use better name
    addLTARRef,
    removeLTARRef,
  }
}, 'smartsheet-row-store')

export { useProvideSmartsheetRowStore }

export function useSmartsheetRowStoreOrThrow() {
  const smartsheetRowStore = useSmartsheetRowStore()
  if (smartsheetRowStore == null) throw new Error('Please call `useSmartsheetRowStore` on the appropriate parent component')
  return smartsheetRowStore
}

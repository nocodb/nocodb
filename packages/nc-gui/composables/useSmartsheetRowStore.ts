import type { MaybeRef } from '@vueuse/core'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState(
  (row: MaybeRef<Row>, changedColumns: Ref<Set<string>> = ref(new Set<string>())) => {
    const currentRow = ref(row)

    // state
    const state = computed({
      get: () => currentRow.value?.rowMeta?.ltarState ?? {},
      set: (value) => {
        if (currentRow.value) {
          if (!currentRow.value.rowMeta) {
            currentRow.value.rowMeta = {}
          }
          currentRow.value.rowMeta.ltarState = value
        }
      },
    })

    const meta = inject(MetaInj, ref())

    const pk = computed(() => extractPkFromRow(currentRow.value.row, meta.value?.columns ?? []))

    // getters
    const isNew = computed(() => unref(row).rowMeta?.new ?? false)

    const displayValue = computed(() => {
      const row = unref(currentRow)

      const column = meta.value?.columns.find((col) => col.pv) || meta.value?.columns.find((col) => col.pk)

      return row.row[column?.title]
    })

    const { addLTARRef, removeLTARRef, syncLTARRefs, loadRow, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

    return {
      pk,
      row,
      changedColumns,
      state,
      isNew,
      displayValue,
      // todo: use better name
      addLTARRef: (...args: any) => addLTARRef(currentRow.value, ...args),
      removeLTARRef: (...args: any) => removeLTARRef(currentRow.value, ...args),
      syncLTARRefs: (...args: any) => syncLTARRefs(currentRow.value, ...args),
      loadRow: (...args: any) => loadRow(currentRow.value, ...args),
      currentRow,
      clearLTARCell: (...args: any) => clearLTARCell(currentRow.value, ...args),
      cleaMMCell: (...args: any) => cleaMMCell(currentRow.value, ...args),
    }
  },
  'smartsheet-row-store',
)

export { useProvideSmartsheetRowStore }

export function useSmartsheetRowStoreOrThrow() {
  const smartsheetRowStore = useSmartsheetRowStore()

  if (smartsheetRowStore == null) throw new Error('Please call `useSmartsheetRowStore` on the appropriate parent component')

  return smartsheetRowStore
}

import type { MaybeRef } from '@vueuse/core'
import type { PendingLtarOp } from '~/utils/ltarDeferredOps'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState(
  (row: MaybeRef<Row>, changedColumns: Ref<Set<string>> = ref(new Set<string>())) => {
    const currentRow = ref(row)

    // Existing-row relation edits deferred by the expanded form until Save (#14013). Shares a
    // home with changedColumns + addLTARRef/removeLTARRef so all relation-deferral state lives
    // in one place. Empty (and unused) in grid / new-row / public contexts.
    const pendingLtarOps = ref<PendingLtarOp[]>([])

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
      pendingLtarOps,
      state,
      isNew,
      displayValue,
      // todo: use better name
      addLTARRef: async (...args: any) => {
        await addLTARRef(currentRow.value, ...args)
        // Force reactivity trigger — nested mutations on row.row may not auto-trigger
        triggerRef(currentRow as Ref)
      },
      removeLTARRef: async (...args: any) => {
        await removeLTARRef(currentRow.value, ...args)
        triggerRef(currentRow as Ref)
      },
      syncLTARRefs: (...args: any) => syncLTARRefs(currentRow.value, ...args),
      loadRow: (...args: any) => loadRow(currentRow.value, ...args),
      currentRow,
      clearLTARCell: (...args: any) => clearLTARCell(currentRow.value, ...args),
      cleaMMCell: (...args: any) => cleaMMCell(currentRow.value, ...args),
    }
  },
  'smartsheet-row-store',
)

export { useProvideSmartsheetRowStore, useSmartsheetRowStore }

export function useSmartsheetRowStoreOrThrow() {
  const smartsheetRowStore = useSmartsheetRowStore()

  if (smartsheetRowStore == null) throw new Error('Please call `useSmartsheetRowStore` on the appropriate parent component')

  return smartsheetRowStore
}

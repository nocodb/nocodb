import type { ShallowRef } from 'vue'
import type { MaybeRef } from '@vueuse/core'
import type { PendingLtarOp } from '~/utils/ltarDeferredOps'

const [useProvideSmartsheetRowStore, useSmartsheetRowStore] = useInjectionState(
  (row: MaybeRef<Row>, changedColumns: ShallowRef<Set<string>> = shallowRef(new Set<string>())) => {
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

    const { addLTARRef, removeLTARRef, loadRow, clearLTARCell, cleaMMCell } = useSmartsheetLtarHelpersOrThrow()

    // Existing-row relation edits deferred by the expanded form until Save (#14013, #14058).
    // A single reconciling queue (link/unlink ops cancel their inverse, dups ignored) replayed
    // on save. New rows instead buffer links in rowMeta.ltarState. Empty in grid / public contexts.
    const pendingLtarOps = ref<PendingLtarOp[]>([])

    // True when the row has buffered link/unlink changes not yet persisted.
    // Drives the expanded form's "modified" state for relational fields.
    const hasLtarChanges = computed(() => {
      const ltarState = currentRow.value?.rowMeta?.ltarState ?? {}
      const hasEntries = (s: Record<string, any>) => Object.values(s).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))
      return pendingLtarOps.value.length > 0 || hasEntries(ltarState)
    })

    return {
      pk,
      row,
      changedColumns,
      state,
      isNew,
      hasLtarChanges,
      pendingLtarOps,
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

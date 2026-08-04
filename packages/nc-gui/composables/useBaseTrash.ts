import type { TableType } from 'nocodb-sdk'
export const useBaseTrash = createSharedComposable(() => {
  const isOpen = ref(false)

  const isLoading = ref(false)

  const trashItems = ref<any[]>([])

  const totalRows = ref(0)

  const currentPage = ref(1)

  const pageSize = ref(25)

  const open = () => {}

  const close = () => {}

  const loadTrash = async (_page = 1) => {}

  const restoreItem = async (_trashId: string) => {}

  const emptyTrash = async () => {}

  // Per-row restore — used by data composables (undo, "restore selected").
  // CE returns immediately; the row stays trashed until an EE caller reaches it.
  async function restoreFromTrash(
    _tableMeta: TableType | undefined,
    _rowIds: string[],
    _callbacks?: {
      onSuccess?: () => Promise<void> | void
      onError?: () => Promise<void> | void
    },
  ): Promise<void> {}

  const trashUnavailableReason = computed<'external' | 'pending' | 'disabled' | 'license' | null>(() => 'license')

  return {
    isOpen,
    isLoading,
    trashItems,
    totalRows,
    currentPage,
    pageSize,
    open,
    close,
    loadTrash,
    restoreItem,
    emptyTrash,
    restoreFromTrash,
    trashUnavailableReason,
  }
})

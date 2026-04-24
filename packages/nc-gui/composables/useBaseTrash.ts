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
  }
})

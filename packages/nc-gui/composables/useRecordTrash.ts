import type { TableType } from 'nocodb-sdk'

export const useRecordTrash = createSharedComposable(() => {
  async function restoreFromTrash(
    _tableMeta: TableType | undefined,
    _rowIds: string[],
    _callbacks?: {
      onSuccess?: () => Promise<void> | void
      onError?: () => Promise<void> | void
    },
  ): Promise<void> {}

  return {
    isOpen: ref(false),
    isLoading: ref(false),
    deletedRecords: ref<Record<string, any>[]>([]),
    trashCount: ref(0),
    currentPage: ref(1),
    pageSize: 25,
    totalCount: ref(0),
    selectedRowIds: ref<string[]>([]),
    pkColumn: computed(() => 'Id'),
    retentionDays: ref(30),
    loadDeletedRecords: async () => {},
    restoreFromTrash,
    restoreRecords: async (_rowIds: string[]) => {},
    permanentDeleteRecords: async (_rowIds: string[]) => {},
    emptyTrash: async () => {},
    openTrash: () => {},
  }
})

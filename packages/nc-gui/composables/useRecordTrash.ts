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
    isLoadingMore: ref(false),
    trashEvents: ref<any[]>([]),
    trashCount: ref(0),
    hasMoreEvents: ref(false),
    retentionDays: ref(30),
    trashUnavailableReason: computed<'external' | 'pending' | 'disabled' | 'license' | null>(() => 'license'),
    loadTrashEvents: async (_opts?: { append?: boolean }) => {},
    loadMoreEvents: async () => {},
    restoreFromTrash,
    restoreEvent: async (_eventId: string) => {},
    permanentDeleteEvent: async (_eventId: string) => {},
    emptyTrash: async () => {},
    openTrash: () => {},
  }
})

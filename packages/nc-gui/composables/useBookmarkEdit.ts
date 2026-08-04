export const useBookmarkEdit = createSharedComposable(() => {
  const isEditing = ref(false)
  const selectedBookmarkIds = ref<Set<string>>(new Set())

  const selectionCount = computed(() => 0)
  const hasSelection = computed(() => false)

  function isBookmarkSelected(_id: string): boolean {
    return false
  }

  function groupSelectionState(_groupId: string): 'checked' | 'indeterminate' | 'unchecked' {
    return 'unchecked'
  }

  const singleSelectedBookmark = computed<any>(() => null)

  function enter() {}
  function exit(_via?: 'close-button' | 'flyout-close' | 'after-open') {}
  function clear() {}
  function toggleBookmark(_id: string) {}
  function toggleGroup(_groupId: string) {}
  async function bulkDelete() {}
  async function bulkMoveToGroup(_targetGroupId: string) {}
  function openSingleSelected() {}
  function openAllInNewTab() {}

  return {
    isEditing,
    selectedBookmarkIds,
    selectionCount,
    hasSelection,
    isBookmarkSelected,
    groupSelectionState,
    singleSelectedBookmark,
    enter,
    exit,
    clear,
    toggleBookmark,
    toggleGroup,
    bulkDelete,
    bulkMoveToGroup,
    openSingleSelected,
    openAllInNewTab,
  }
})

export const useBookmarks = createSharedComposable(() => {
  const bookmarks = ref([])
  const groups = ref([])
  const isLoading = ref(false)
  const bookmarkCheckMap = ref({})

  const orderedGroups = computed(() => [])
  const bookmarksByGroup = computed(() => ({}))

  async function loadBookmarks() {}
  async function loadBookmarkCheck() {}
  async function addBookmark(_data: any) {}
  async function removeBookmark(_id: string) {}
  async function updateBookmark(_id: string, _data: any) {}
  async function addGroup(_data: any) {}
  async function removeGroup(_id: string) {}
  async function updateGroup(_id: string, _data: any) {}
  function isBookmarked(_targetType: string, _targetId: string, _meta?: Record<string, any>): boolean { return false }
  function isBookmarkedByCheck(_targetType: string, _targetId: string, _meta?: Record<string, any>): boolean { return false }
  function getBookmark(_targetType: string, _targetId: string): any { return undefined }
  function resolveBookmarkRoute(_bookmark: any): any { return null }
  async function navigateToBookmark(_bookmark: any) {}

  return {
    bookmarks,
    groups,
    isLoading,
    bookmarkCheckMap,
    orderedGroups,
    bookmarksByGroup,
    loadBookmarks,
    loadBookmarkCheck,
    addBookmark,
    removeBookmark,
    updateBookmark,
    addGroup,
    removeGroup,
    updateGroup,
    isBookmarked,
    isBookmarkedByCheck,
    getBookmark,
    resolveBookmarkRoute,
    navigateToBookmark,
  }
})

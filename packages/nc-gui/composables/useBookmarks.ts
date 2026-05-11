export const useBookmarks = createSharedComposable(() => {
  const bookmarks = ref([])
  const groups = ref([])
  const isLoading = ref(false)
  const bookmarkCheckMap = ref({})
  const isCreatingFolder = ref(false)
  const collapsedGroupIds = ref<Set<string>>(new Set())

  const orderedGroups = computed(() => [])
  const bookmarksByGroup = computed(() => ({}))
  const isBookmarkAllowed = computed(() => false)

  async function loadBookmarks() {}
  async function loadBookmarkCheck() {}
  async function addBookmark(_data: any) {}
  async function removeBookmark(_id: string) {}
  async function removeBookmarkByTarget(_targetType: string, _targetId: string, _meta?: Record<string, any>) {}
  async function updateBookmark(_id: string, _data: any) {}
  async function addGroup(_data: any) {}
  async function removeGroup(_id: string) {}
  async function updateGroup(_id: string, _data: any) {}
  function isBookmarked(_targetType: string, _targetId: string, _meta?: Record<string, any>): boolean {
    return false
  }
  function isBookmarkedByCheck(_targetType: string, _targetId: string, _meta?: Record<string, any>): boolean {
    return false
  }
  function getBookmark(_targetType: string, _targetId: string): any {
    return undefined
  }
  function resolveBookmarkRoute(_bookmark: any): any {
    return null
  }
  async function navigateToBookmark(_bookmark: any, _options?: { inNewTab?: boolean }) {}
  function onNavigated(_cb: () => void) {}
  async function moveBookmarkToGroup(_bookmarkId: string, _targetGroupId: string, _targetIndex?: number) {}
  async function reorderBookmark(_bookmarkId: string, _groupId: string, _targetIndex: number) {}
  async function reorderGroup(_groupId: string, _targetIndex: number) {}
  function toggleGroupCollapsed(_groupId: string) {}
  function isGroupCollapsed(_groupId: string): boolean {
    return false
  }
  const areAllGroupsCollapsed = computed(() => false)
  function expandAllGroups() {}
  function collapseAllGroups() {}

  return {
    bookmarks,
    groups,
    isLoading,
    bookmarkCheckMap,
    isCreatingFolder,
    orderedGroups,
    bookmarksByGroup,
    isBookmarkAllowed,
    loadBookmarks,
    loadBookmarkCheck,
    addBookmark,
    removeBookmark,
    removeBookmarkByTarget,
    updateBookmark,
    addGroup,
    removeGroup,
    updateGroup,
    isBookmarked,
    isBookmarkedByCheck,
    getBookmark,
    resolveBookmarkRoute,
    navigateToBookmark,
    onNavigated,
    moveBookmarkToGroup,
    reorderBookmark,
    collapsedGroupIds,
    toggleGroupCollapsed,
    isGroupCollapsed,
    areAllGroupsCollapsed,
    expandAllGroups,
    collapseAllGroups,
    reorderGroup,
  }
})

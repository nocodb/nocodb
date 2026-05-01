import type { BookmarkType } from 'nocodb-sdk'

export const useBookmarkDnd = createSharedComposable(() => {
  const { moveBookmarkToGroup, reorderBookmark, reorderGroup } = useBookmarks()

  // Bookmark drag state
  const draggingBookmarkId = ref<string | null>(null)
  const draggingFromGroupId = ref<string | null>(null)
  const hoverGroupId = ref<string | null>(null)
  const dropIndex = ref<number | null>(null)

  // Group drag state
  const draggingGroupId = ref<string | null>(null)
  const groupDropIndex = ref<number | null>(null)

  function onDragStart(bookmark: BookmarkType) {
    draggingBookmarkId.value = bookmark.id!
    draggingFromGroupId.value = bookmark.fk_group_id!
  }

  function onGroupDragStart(groupId: string) {
    draggingGroupId.value = groupId
  }

  function onDragEnd() {
    draggingBookmarkId.value = null
    draggingFromGroupId.value = null
    hoverGroupId.value = null
    dropIndex.value = null
    draggingGroupId.value = null
    groupDropIndex.value = null
  }

  function onDragEnterGroup(groupId: string) {
    hoverGroupId.value = groupId
  }

  function onDragLeaveGroup(groupId: string) {
    if (hoverGroupId.value === groupId) {
      hoverGroupId.value = null
      dropIndex.value = null
    }
  }

  function updateDropIndex(groupId: string, index: number) {
    hoverGroupId.value = groupId
    dropIndex.value = index
  }

  async function onDropOnGroup(groupId: string) {
    const bookmarkId = draggingBookmarkId.value
    let targetIndex = dropIndex.value

    if (!bookmarkId) {
      onDragEnd()
      return
    }

    const isSameGroup = draggingFromGroupId.value === groupId

    if (isSameGroup) {
      // Reorder within same group
      // The visual drop index includes the dragged item, but calcOrderForIndex
      // excludes it. When dragging downward, adjust index to compensate.
      if (targetIndex != null) {
        const { bookmarksByGroup } = useBookmarks()
        const groupItems = bookmarksByGroup.value[groupId] ?? []
        const currentIdx = groupItems.findIndex((b) => b.id === bookmarkId)
        if (currentIdx !== -1 && currentIdx < targetIndex) {
          targetIndex--
        }
        await reorderBookmark(bookmarkId, groupId, targetIndex)
      }
    } else {
      // Move to different group at position
      await moveBookmarkToGroup(bookmarkId, groupId, targetIndex ?? undefined)
    }

    onDragEnd()
  }

  function updateGroupDropIndex(index: number) {
    groupDropIndex.value = index
  }

  async function onDropGroup(targetIndex: number) {
    const groupId = draggingGroupId.value
    if (!groupId) {
      onDragEnd()
      return
    }

    await reorderGroup(groupId, targetIndex)
    onDragEnd()
  }

  return {
    draggingBookmarkId,
    draggingFromGroupId,
    hoverGroupId,
    dropIndex,
    draggingGroupId,
    groupDropIndex,
    onDragStart,
    onGroupDragStart,
    onDragEnd,
    onDragEnterGroup,
    onDragLeaveGroup,
    updateDropIndex,
    onDropOnGroup,
    updateGroupDropIndex,
    onDropGroup,
  }
})

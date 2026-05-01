import type { BookmarkType } from 'nocodb-sdk'

export const useBookmarkDnd = createSharedComposable(() => {
  const { moveBookmarkToGroup, reorderBookmark } = useBookmarks()

  const draggingBookmarkId = ref<string | null>(null)
  const draggingFromGroupId = ref<string | null>(null)
  const hoverGroupId = ref<string | null>(null)
  const dropIndex = ref<number | null>(null)

  function onDragStart(bookmark: BookmarkType) {
    draggingBookmarkId.value = bookmark.id!
    draggingFromGroupId.value = bookmark.fk_group_id!
  }

  function onDragEnd() {
    draggingBookmarkId.value = null
    draggingFromGroupId.value = null
    hoverGroupId.value = null
    dropIndex.value = null
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
    const targetIndex = dropIndex.value

    if (!bookmarkId) {
      onDragEnd()
      return
    }

    const isSameGroup = draggingFromGroupId.value === groupId

    if (isSameGroup) {
      // Reorder within same group
      if (targetIndex != null) {
        await reorderBookmark(bookmarkId, groupId, targetIndex)
      }
    } else {
      // Move to different group at position
      await moveBookmarkToGroup(bookmarkId, groupId, targetIndex ?? undefined)
    }

    onDragEnd()
  }

  return {
    draggingBookmarkId,
    draggingFromGroupId,
    hoverGroupId,
    dropIndex,
    onDragStart,
    onDragEnd,
    onDragEnterGroup,
    onDragLeaveGroup,
    updateDropIndex,
    onDropOnGroup,
  }
})

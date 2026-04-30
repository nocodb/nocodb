import type { BookmarkGroupReqType, BookmarkGroupType, BookmarkReqType, BookmarkType } from 'nocodb-sdk'
import { NO_SCOPE } from 'nocodb-sdk'
import type { RouteLocationRaw } from 'vue-router'

export const useBookmarks = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const router = useRouter()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const bookmarks = ref<BookmarkType[]>([])
  const groups = ref<BookmarkGroupType[]>([])
  const isLoading = ref(false)

  const orderedGroups = computed(() =>
    [...groups.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  )

  const bookmarksByGroup = computed<Record<string, BookmarkType[]>>(() => {
    const map: Record<string, BookmarkType[]> = {}

    for (const group of orderedGroups.value) {
      map[group.id!] = []
    }

    for (const bm of bookmarks.value) {
      if (bm.fk_group_id && map[bm.fk_group_id]) {
        map[bm.fk_group_id].push(bm)
      }
    }

    // Sort bookmarks within each group by order
    for (const groupId in map) {
      map[groupId].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    return map
  })

  async function loadBookmarks() {
    if (!activeWorkspaceId.value) return

    try {
      isLoading.value = true

      const res = (await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'bookmarkList',
      })) as any
      bookmarks.value = res.bookmarks ?? []
      groups.value = res.groups ?? []
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  async function addBookmark(data: BookmarkReqType) {
    if (!activeWorkspaceId.value) return

    try {
      const bm = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkCreate' },
        data,
      )) as BookmarkType
      bookmarks.value.push(bm)

      // If groups were empty, the backend created "Ungrouped" — reload to get it
      if (!groups.value.length) {
        await loadBookmarks()
      }

      message.success(t('msg.bookmarkAdded'))
      $e('a:bookmark:create', { target_type: data.target_type })

      return bm
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function removeBookmark(id: string) {
    if (!activeWorkspaceId.value) return

    try {
      const bm = bookmarks.value.find((b) => b.id === id)

      await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkDelete' },
        { bookmarkId: id },
      )
      bookmarks.value = bookmarks.value.filter((b) => b.id !== id)

      message.success(t('msg.bookmarkRemoved'))

      if (bm) {
        $e('a:bookmark:delete', { target_type: bm.target_type })
      }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function updateBookmark(id: string, data: Partial<BookmarkType>) {
    if (!activeWorkspaceId.value) return

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkUpdate' },
        {
          bookmarkId: id,
          ...data,
        },
      )) as BookmarkType

      const idx = bookmarks.value.findIndex((b) => b.id === id)
      if (idx !== -1) {
        bookmarks.value[idx] = updated
      }

      return updated
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function addGroup(data: BookmarkGroupReqType) {
    if (!activeWorkspaceId.value) return

    try {
      const group = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkGroupCreate' },
        data,
      )) as BookmarkGroupType
      groups.value.push(group)
      return group
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function removeGroup(id: string) {
    if (!activeWorkspaceId.value) return

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkGroupDelete' },
        { groupId: id },
      )

      // Reload to get updated bookmarks (moved to Ungrouped)
      await loadBookmarks()

      message.success(t('msg.bookmarkGroupDeleted'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function updateGroup(id: string, data: Partial<BookmarkGroupType>) {
    if (!activeWorkspaceId.value) return

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        NO_SCOPE,
        { operation: 'bookmarkGroupUpdate' },
        {
          groupId: id,
          ...data,
        },
      )) as BookmarkGroupType

      const idx = groups.value.findIndex((g) => g.id === id)
      if (idx !== -1) {
        groups.value[idx] = updated
      }

      return updated
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  function isBookmarked(targetType: string, targetId: string): boolean {
    return bookmarks.value.some(
      (b) => b.target_type === targetType && b.target_id === targetId,
    )
  }

  function getBookmark(targetType: string, targetId: string): BookmarkType | undefined {
    return bookmarks.value.find(
      (b) => b.target_type === targetType && b.target_id === targetId,
    )
  }

  function resolveBookmarkRoute(bookmark: BookmarkType): RouteLocationRaw | null {
    const meta = bookmark.meta ?? {}

    switch (bookmark.target_type) {
      case 'workspace':
        return { path: `/${bookmark.target_id}` }
      case 'base':
        if (meta.workspace_id) {
          return { path: `/${meta.workspace_id}/${bookmark.target_id}` }
        }
        return null
      case 'table':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/${bookmark.target_id}` }
        }
        return null
      case 'view':
        if (meta.workspace_id && meta.base_id && meta.table_id) {
          return {
            path: `/${meta.workspace_id}/${meta.base_id}/${meta.table_id}`,
            query: { viewId: bookmark.target_id },
          }
        }
        return null
      case 'document':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/doc/${bookmark.target_id}` }
        }
        return null
      case 'workflow':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/automation/${bookmark.target_id}` }
        }
        return null
      case 'script':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/automation/script/${bookmark.target_id}` }
        }
        return null
      default:
        return null
    }
  }

  async function navigateToBookmark(bookmark: BookmarkType) {
    const route = resolveBookmarkRoute(bookmark)
    if (route) {
      try {
        await router.push(route)
      } catch {
        message.error(t('msg.info.targetNotFound'))
      }
    } else {
      message.error(t('msg.info.targetNotFound'))
    }
  }

  return {
    bookmarks,
    groups,
    isLoading,
    orderedGroups,
    bookmarksByGroup,
    loadBookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    addGroup,
    removeGroup,
    updateGroup,
    isBookmarked,
    getBookmark,
    resolveBookmarkRoute,
    navigateToBookmark,
  }
})

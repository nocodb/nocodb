import type { BookmarkGroupReqType, BookmarkGroupType, BookmarkReqType, BookmarkType } from 'nocodb-sdk'
import type { RouteLocationRaw } from 'vue-router'

export const useBookmarks = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const router = useRouter()
  const { blockBookmarks } = useEeConfig()

  const bookmarks = ref<BookmarkType[]>([])
  const groups = ref<BookmarkGroupType[]>([])
  const isLoading = ref(false)
  const bookmarkCheckMap = ref<Record<string, any>>({})
  const isCreatingFolder = ref(false)
  const collapsedGroupIds = ref<Set<string>>(new Set())

  // Ungrouped is always pinned first; the rest follow `order` ascending.
  const orderedGroups = computed(() => {
    const isUngrouped = (g: BookmarkGroupType) => g.name === 'Ungrouped'
    return [...groups.value].sort((a, b) => {
      if (isUngrouped(a) && !isUngrouped(b)) return -1
      if (!isUngrouped(a) && isUngrouped(b)) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    })
  })

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
    if (blockBookmarks.value) return

    try {
      isLoading.value = true

      const res = (await $api.bookmark.list()) as any
      bookmarks.value = res.bookmarks ?? []
      groups.value = res.groups ?? []
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  async function loadBookmarkCheck() {
    if (blockBookmarks.value) return

    try {
      const res = (await $api.bookmark.check()) as Record<string, any>
      bookmarkCheckMap.value = res ?? {}
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  function isBookmarkedByCheck(targetType: string, targetId: string, meta?: Record<string, any>): boolean {
    const map = bookmarkCheckMap.value

    switch (targetType) {
      case 'workspace':
        return !!map[targetId]?._exists
      case 'base':
        return !!map[meta?.workspace_id]?.[targetId]?._exists
      case 'table':
      case 'document':
      case 'workflow':
      case 'script':
        return !!map[meta?.workspace_id]?.[meta?.base_id]?.[targetId]
      case 'view':
        return !!map[meta?.workspace_id]?.[meta?.base_id]?.[meta?.table_id]?.[targetId]
      default:
        return false
    }
  }

  function ensureObj(parent: Record<string, any>, key: string): Record<string, any> {
    if (!parent[key] || typeof parent[key] !== 'object') parent[key] = {}
    return parent[key]
  }

  function setBookmarkCheck(targetType: string, targetId: string, meta: Record<string, any> | undefined, value: boolean) {
    const map = bookmarkCheckMap.value

    switch (targetType) {
      case 'workspace': {
        const node = ensureObj(map, targetId)
        node._exists = value
        break
      }
      case 'base': {
        if (meta?.workspace_id) {
          const wsNode = ensureObj(map, meta.workspace_id)
          const baseNode = ensureObj(wsNode, targetId)
          baseNode._exists = value
        }
        break
      }
      case 'table':
      case 'document':
      case 'workflow':
      case 'script': {
        if (meta?.workspace_id && meta?.base_id) {
          const wsNode = ensureObj(map, meta.workspace_id)
          const baseNode = ensureObj(wsNode, meta.base_id)
          if (value) {
            ensureObj(baseNode, targetId)
          } else {
            delete baseNode[targetId]
          }
        }
        break
      }
      case 'view': {
        if (meta?.workspace_id && meta?.base_id && meta?.table_id) {
          const wsNode = ensureObj(map, meta.workspace_id)
          const baseNode = ensureObj(wsNode, meta.base_id)
          const tableNode = ensureObj(baseNode, meta.table_id)
          if (value) {
            ensureObj(tableNode, targetId)
          } else {
            delete tableNode[targetId]
          }
        }
        break
      }
    }

    bookmarkCheckMap.value = { ...map }
  }

  async function addBookmark(data: BookmarkReqType) {
    try {
      const bm = (await $api.bookmark.create(data)) as BookmarkType
      setBookmarkCheck(data.target_type!, data.target_id!, data.meta as Record<string, any>, true)

      // Reload to get enriched data (resolved_title, icons) and any auto-created groups
      await loadBookmarks()

      message.success(t('msg.bookmarkAdded'))
      $e('a:bookmark:create', { target_type: data.target_type })

      return bm
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function removeBookmark(id: string) {
    try {
      const bm = bookmarks.value.find((b) => b.id === id)

      await $api.bookmark.delete(id)
      bookmarks.value = bookmarks.value.filter((b) => b.id !== id)

      if (bm) {
        setBookmarkCheck(bm.target_type!, bm.target_id!, bm.meta as Record<string, any>, false)
        $e('a:bookmark:delete', { target_type: bm.target_type })
      }

      message.success(t('msg.bookmarkRemoved'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function updateBookmark(id: string, data: Partial<BookmarkType>) {
    try {
      const updated = (await $api.bookmark.update(id, data)) as BookmarkType

      const idx = bookmarks.value.findIndex((b) => b.id === id)
      if (idx !== -1) {
        // Preserve resolved_title from the enriched list if backend didn't return it
        if (!updated.resolved_title && bookmarks.value[idx].resolved_title) {
          updated.resolved_title = bookmarks.value[idx].resolved_title
        }
        bookmarks.value[idx] = updated
      }

      return updated
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function addGroup(data: BookmarkGroupReqType) {
    try {
      const group = (await $api.bookmark.groupCreate(data)) as BookmarkGroupType
      groups.value.push(group)
      return group
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function removeGroup(id: string) {
    try {
      await $api.bookmark.groupDelete(id)

      // Reload to get updated bookmarks (moved to Ungrouped)
      await loadBookmarks()

      message.success(t('msg.bookmarkGroupDeleted'))
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function updateGroup(id: string, data: Partial<BookmarkGroupType>) {
    try {
      const updated = (await $api.bookmark.groupUpdate(id, data)) as BookmarkGroupType

      const idx = groups.value.findIndex((g) => g.id === id)
      if (idx !== -1) {
        groups.value[idx] = updated
      }

      return updated
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  function isBookmarked(targetType: string, targetId: string, meta?: Record<string, any>): boolean {
    if (Object.keys(bookmarkCheckMap.value).length) {
      return isBookmarkedByCheck(targetType, targetId, meta)
    }

    return bookmarks.value.some((b) => b.target_type === targetType && b.target_id === targetId)
  }

  function getBookmark(targetType: string, targetId: string): BookmarkType | undefined {
    return bookmarks.value.find((b) => b.target_type === targetType && b.target_id === targetId)
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
            path: `/${meta.workspace_id}/${meta.base_id}/${meta.table_id}/${bookmark.target_id}`,
          }
        }
        return null
      case 'document':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/docs/${bookmark.target_id}` }
        }
        return null
      case 'workflow':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/workflows/${bookmark.target_id}` }
        }
        return null
      case 'script':
        if (meta.workspace_id && meta.base_id) {
          return { path: `/${meta.workspace_id}/${meta.base_id}/scripts/${bookmark.target_id}` }
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

  function toggleGroupCollapsed(groupId: string) {
    const s = new Set(collapsedGroupIds.value)
    if (s.has(groupId)) {
      s.delete(groupId)
    } else {
      s.add(groupId)
    }
    collapsedGroupIds.value = s
  }

  function isGroupCollapsed(groupId: string): boolean {
    return collapsedGroupIds.value.has(groupId)
  }

  /**
   * Reindex helper — assigns clean sequential integer orders.
   * Solves the "everyone has order=0" / "fractional collisions" problem:
   * existing data may have many duplicate or near-duplicate order values
   * (drift from repeated midpoint math). Each reorder normalizes the affected
   * list to 1..N so subsequent reorders behave reliably.
   *
   * Returns the optimistic update objects so callers can fire the API calls
   * in parallel and roll back if something fails.
   */
  function buildReindexUpdates<T extends { id?: string; order?: number }>(
    items: T[],
  ): Array<{ item: T; nextOrder: number; prevOrder: number | undefined }> {
    const updates: Array<{ item: T; nextOrder: number; prevOrder: number | undefined }> = []
    items.forEach((it, idx) => {
      const nextOrder = idx + 1
      if (it.order !== nextOrder) {
        updates.push({ item: it, nextOrder, prevOrder: it.order })
        it.order = nextOrder
      }
    })
    return updates
  }

  async function reorderGroup(groupId: string, targetIndex: number) {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return
    // Ungrouped is pinned first; never reorder it
    if (group.name === 'Ungrouped') return

    // Build the list as the user wants to see it, excluding Ungrouped
    // (Ungrouped stays at index 0 via orderedGroups sort logic).
    const reorderable = orderedGroups.value.filter((g) => g.name !== 'Ungrouped' && g.id !== groupId)
    // targetIndex is computed against orderedGroups (which has Ungrouped at 0).
    // Convert to an index inside `reorderable` by shifting past the Ungrouped slot.
    const ungroupedExists = groups.value.some((g) => g.name === 'Ungrouped')
    const finalIdx = Math.max(0, Math.min(reorderable.length, ungroupedExists ? targetIndex - 1 : targetIndex))

    const desired = [...reorderable.slice(0, finalIdx), group, ...reorderable.slice(finalIdx)]

    // Reindex everyone to clean integers
    const updates = buildReindexUpdates(desired)
    if (updates.length === 0) return

    try {
      await Promise.all(updates.map((u) => $api.bookmark.groupUpdate(u.item.id!, { order: u.nextOrder } as any)))
    } catch (e: any) {
      // Roll back optimistic updates
      updates.forEach((u) => (u.item.order = u.prevOrder))
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function moveBookmarkToGroup(bookmarkId: string, targetGroupId: string, targetIndex?: number) {
    const bm = bookmarks.value.find((b) => b.id === bookmarkId)
    if (!bm || bm.fk_group_id === targetGroupId) return

    const prevGroupId = bm.fk_group_id
    const prevOrder = bm.order

    // Optimistic group change first
    bm.fk_group_id = targetGroupId

    // Build the desired final order in the destination group
    const inTarget = bookmarks.value
      .filter((b) => b.fk_group_id === targetGroupId && b.id !== bookmarkId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const insertAt = targetIndex != null ? Math.max(0, Math.min(inTarget.length, targetIndex)) : inTarget.length
    const desired = [...inTarget.slice(0, insertAt), bm, ...inTarget.slice(insertAt)]

    const updates = buildReindexUpdates(desired)

    try {
      // The moved bookmark gets group_id + order; siblings only get order.
      await $api.bookmark.update(bookmarkId, { fk_group_id: targetGroupId, order: bm.order } as any)
      await Promise.all(
        updates
          .filter((u) => u.item.id !== bookmarkId)
          .map((u) => $api.bookmark.update(u.item.id!, { order: u.nextOrder } as any)),
      )
      $e('a:bookmark:move', { target_type: bm.target_type })
    } catch (e: any) {
      // Revert: group + all reindexed siblings
      bm.fk_group_id = prevGroupId
      bm.order = prevOrder
      updates.forEach((u) => (u.item.order = u.prevOrder))
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function reorderBookmark(bookmarkId: string, groupId: string, targetIndex: number) {
    const bm = bookmarks.value.find((b) => b.id === bookmarkId)
    if (!bm) return

    // Reindex the whole group's bookmarks to clean integer orders
    const inGroup = bookmarks.value
      .filter((b) => b.fk_group_id === groupId && b.id !== bookmarkId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const insertAt = Math.max(0, Math.min(inGroup.length, targetIndex))
    const desired = [...inGroup.slice(0, insertAt), bm, ...inGroup.slice(insertAt)]

    const updates = buildReindexUpdates(desired)
    if (updates.length === 0) return

    try {
      await Promise.all(updates.map((u) => $api.bookmark.update(u.item.id!, { order: u.nextOrder } as any)))
    } catch (e: any) {
      updates.forEach((u) => (u.item.order = u.prevOrder))
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  loadBookmarkCheck()

  return {
    bookmarks,
    groups,
    isLoading,
    bookmarkCheckMap,
    isCreatingFolder,
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
    moveBookmarkToGroup,
    reorderBookmark,
    collapsedGroupIds,
    toggleGroupCollapsed,
    isGroupCollapsed,
    reorderGroup,
  }
})

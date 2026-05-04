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

  function calcGroupOrderForIndex(targetIndex: number, excludeId?: string): number {
    const items = [...groups.value].filter((g) => g.id !== excludeId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    if (items.length === 0) return 1
    if (targetIndex <= 0) return (items[0].order ?? 0) / 2
    if (targetIndex >= items.length) return (items[items.length - 1].order ?? 0) + 1

    const prev = items[targetIndex - 1].order ?? 0
    const next = items[targetIndex].order ?? 0
    return (prev + next) / 2
  }

  async function reorderGroup(groupId: string, targetIndex: number) {
    const group = groups.value.find((g) => g.id === groupId)
    if (!group) return

    const prevOrder = group.order
    const newOrder = calcGroupOrderForIndex(targetIndex, groupId)

    // Optimistic update
    group.order = newOrder

    try {
      await $api.bookmark.groupUpdate(groupId, { order: newOrder } as any)
    } catch (e: any) {
      group.order = prevOrder
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  function calcOrderForIndex(groupId: string, targetIndex: number, excludeId?: string): number {
    const items = bookmarks.value
      .filter((b) => b.fk_group_id === groupId && b.id !== excludeId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    if (items.length === 0) return 1
    if (targetIndex <= 0) return (items[0].order ?? 0) / 2 || 0.5
    if (targetIndex >= items.length) return (items[items.length - 1].order ?? 0) + 1

    const prev = items[targetIndex - 1].order ?? 0
    const next = items[targetIndex].order ?? 0
    return (prev + next) / 2
  }

  async function moveBookmarkToGroup(bookmarkId: string, targetGroupId: string, targetIndex?: number) {
    const bm = bookmarks.value.find((b) => b.id === bookmarkId)
    if (!bm || bm.fk_group_id === targetGroupId) return

    const prevGroupId = bm.fk_group_id
    const prevOrder = bm.order

    const newOrder = targetIndex != null ? calcOrderForIndex(targetGroupId, targetIndex) : undefined

    // Optimistic update
    bm.fk_group_id = targetGroupId
    if (newOrder != null) bm.order = newOrder

    try {
      const update: any = { fk_group_id: targetGroupId }
      if (newOrder != null) update.order = newOrder
      await $api.bookmark.update(bookmarkId, update)
      $e('a:bookmark:move', { target_type: bm.target_type })
    } catch (e: any) {
      // Revert on failure
      bm.fk_group_id = prevGroupId
      bm.order = prevOrder
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  async function reorderBookmark(bookmarkId: string, groupId: string, targetIndex: number) {
    const bm = bookmarks.value.find((b) => b.id === bookmarkId)
    if (!bm) return

    const prevOrder = bm.order
    const newOrder = calcOrderForIndex(groupId, targetIndex, bookmarkId)

    // Optimistic update
    bm.order = newOrder

    try {
      await $api.bookmark.update(bookmarkId, { order: newOrder } as any)
    } catch (e: any) {
      bm.order = prevOrder
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

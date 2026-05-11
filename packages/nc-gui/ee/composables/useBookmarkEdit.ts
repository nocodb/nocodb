import type { BookmarkType } from 'nocodb-sdk'

export const useBookmarkEdit = createSharedComposable(() => {
  const { $api, $e } = useNuxtApp()

  const { t } = useI18n()

  const router = useRouter()

  const { bookmarks, bookmarksByGroup, moveBookmarkToGroup, resolveBookmarkRoute, navigateToBookmark, loadBookmarks } =
    useBookmarks()

  const isEditing = ref(false)
  const selectedBookmarkIds = ref<Set<string>>(new Set())

  const selectionCount = computed(() => selectedBookmarkIds.value.size)
  const hasSelection = computed(() => selectionCount.value > 0)

  function isBookmarkSelected(id: string): boolean {
    return selectedBookmarkIds.value.has(id)
  }

  function groupSelectionState(groupId: string): 'checked' | 'indeterminate' | 'unchecked' {
    const items = bookmarksByGroup.value[groupId] ?? []
    if (!items.length) return 'unchecked'
    let count = 0
    for (const bm of items) {
      if (selectedBookmarkIds.value.has(bm.id!)) count++
    }
    if (count === 0) return 'unchecked'
    if (count === items.length) return 'checked'
    return 'indeterminate'
  }

  // Move-to / Open are single-bookmark-only. The folder checkbox is just an
  // item-selection shortcut — bulk actions always act on bookmarks, never on
  // folders themselves — so a folder of one ticked counts as a single
  // bookmark selection here.
  const singleSelectedBookmark = computed<BookmarkType | null>(() => {
    if (selectionCount.value !== 1) return null
    const id = [...selectedBookmarkIds.value][0]
    return bookmarks.value.find((b) => b.id === id) ?? null
  })

  function enter() {
    if (isEditing.value) return
    isEditing.value = true
    $e('a:bookmark:edit:enter')
  }

  function exit(via: 'close-button' | 'flyout-close' | 'after-open' = 'close-button') {
    if (!isEditing.value) return
    isEditing.value = false
    clear()
    $e('a:bookmark:edit:exit', { via })
  }

  function clear() {
    if (!selectedBookmarkIds.value.size) return
    selectedBookmarkIds.value = new Set()
  }

  function toggleBookmark(id: string) {
    const next = new Set(selectedBookmarkIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedBookmarkIds.value = next
  }

  function toggleGroup(groupId: string) {
    const items = bookmarksByGroup.value[groupId] ?? []
    if (!items.length) return
    const state = groupSelectionState(groupId)
    const next = new Set(selectedBookmarkIds.value)
    if (state === 'checked') {
      for (const bm of items) next.delete(bm.id!)
    } else {
      for (const bm of items) next.add(bm.id!)
    }
    selectedBookmarkIds.value = next
  }

  async function bulkDelete() {
    if (!hasSelection.value) return

    // Folder checkboxes are only a way to bulk-select their items — bulk
    // delete never removes the folder itself (folders are deleted via the
    // existing folder context menu). So we just drop every selected bookmark.
    const allSelected = [...selectedBookmarkIds.value]

    try {
      await Promise.all(allSelected.map((id) => $api.bookmark.delete(id)))

      $e('a:bookmark:bulk-delete', { count: allSelected.length })

      const msg = allSelected.length === 1 ? t('msg.bookmarkRemoved') : t('msg.bookmarksDeleted', { count: allSelected.length })
      message.toast(msg)

      clear()
      await loadBookmarks()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      // Reload to recover from any partial state
      await loadBookmarks()
    }
  }

  async function bulkMoveToGroup(targetGroupId: string) {
    if (!hasSelection.value) return

    // Move every selected bookmark whose group isn't already the target.
    // moveBookmarkToGroup handles ordering inside the destination group, so
    // running them sequentially keeps the inserted order stable.
    const toMove = [...selectedBookmarkIds.value]
      .map((id) => bookmarks.value.find((b) => b.id === id))
      .filter((b): b is BookmarkType => !!b && b.fk_group_id !== targetGroupId)

    if (!toMove.length) {
      clear()
      return
    }

    for (const bm of toMove) {
      await moveBookmarkToGroup(bm.id!, targetGroupId)
    }

    $e('a:bookmark:bulk-move', { count: toMove.length })
    clear()
  }

  function openSingleSelected() {
    const single = singleSelectedBookmark.value
    if (!single) return
    // navigateToBookmark fires useBookmarks.onNavigated on success, which the
    // flyout uses to close itself — no manual close signal needed here.
    navigateToBookmark(single)
    exit('after-open')
  }

  function openAllInNewTab() {
    if (!hasSelection.value) return

    // Build the URL list up-front. Snapshotting to a plain array avoids any
    // reactive-proxy weirdness during iteration and keeps the open loop as
    // tight as possible — browsers only honor multiple popup-style calls
    // when they happen back-to-back inside the same user-gesture handler.
    const ids = Array.from(selectedBookmarkIds.value)
    const hrefs: string[] = []
    for (const id of ids) {
      const bm = bookmarks.value.find((b) => b.id === id)
      if (!bm) continue
      const route = resolveBookmarkRoute(bm)
      if (!route) continue
      hrefs.push(router.resolve(route).href)
    }

    // Note: browsers cap simultaneous popups from one user gesture. Some of
    // these may be blocked — Chrome surfaces a popup-blocked icon in the URL
    // bar in that case, and the user can allow popups for the site to make
    // bulk opens work going forward.
    for (const href of hrefs) {
      navigateTo(href, { open: navigateToBlankTargetOpenOption })
    }

    if (hrefs.length > 0) $e('a:bookmark:open-in-new-tab', { count: hrefs.length })
    clear()
  }

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

import type { DocRevisionSource } from 'nocodb-sdk'

export interface DocRevisionListItem {
  id: string
  fk_doc_id: string
  version: number
  title: string
  created_by?: string
  /** Resolved at the client from basesUser map for rendering. */
  created_by_display_name?: string
  created_by_email?: string
  /** User meta (icon / iconType) — drives the profile picture in the avatar. */
  created_by_meta?: Record<string, any> | null
  source: DocRevisionSource
  created_at: string
}

export interface DocRevisionFull extends DocRevisionListItem {
  content: Record<string, any>
}

/**
 * Composable for document revision history.
 *
 * Singleton per Vue app instance — the History panel and any modals consume
 * the same loading state. Scoped to a single doc at a time via `activeDocId`.
 */
export const useDocRevisions = createSharedComposable(() => {
  const { user } = useGlobal()
  const { isUIAllowed } = useRoles()
  const { $api, $e } = useNuxtApp()
  const basesStore = useBases()
  const { basesUser } = storeToRefs(basesStore)
  const documentsStore = useDocumentsStore()
  const { documents } = storeToRefs(documentsStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const { activeProjectId } = storeToRefs(useBases())

  const activeDocId = ref<string | null>(null)
  const revisions = ref<DocRevisionListItem[]>([])
  const isLoading = ref(false)
  const hasMore = ref(false)
  const nextCursor = ref<string | null>(null)

  // Plan-determined retention window in days. `null` = unlimited.
  // Updated by every successful list call so the banner copy stays in sync
  // if the plan changes mid-session.
  const retentionDays = ref<number | null>(null)

  // The revision currently selected for preview in the panel. Cleared when the
  // panel closes or when the user clicks "Current version".
  const selectedRevisionId = ref<string | null>(null)
  const selectedRevisionContent = ref<DocRevisionFull | null>(null)
  const isLoadingSelected = ref(false)
  const isRestoring = ref(false)

  // Diff state — paired with the selected revision. We always compare to
  // the chronologically prior revision; the basis selector + highlight toggle
  // were dropped from the UI in favor of a single canonical view.
  const comparisonContent = ref<Record<string, any> | null>(null)
  // Title of the chronologically prior revision — surfaced so the H1 in the
  // preview pane can render a word-level rename diff (parity with body diff).
  const comparisonTitle = ref<string | null>(null)

  // Event fired after a successful restore. The active Editor.vue listens
  // and force-reloads its content from the server — needed because the
  // editor's local PM state can diverge from the restored content (the
  // auto-reload watcher in useDocumentAutoSave bails out when the user
  // has unsaved edits or a pending debounced save, and the restore would
  // otherwise be silently overwritten by the next autosave).
  const restoredHook = createEventHook<{ docId: string }>()

  // Step-through nav state. `diffChangeCount` is written by the Viewer
  // whenever the diff is recomputed; `currentChangeIndex` is driven by
  // the modal's ↑/↓ buttons. The Viewer watches the index and scrolls
  // its editor accordingly.
  const diffChangeCount = ref(0)
  const currentChangeIndex = ref(0)

  function nextChange() {
    if (diffChangeCount.value === 0) return
    currentChangeIndex.value = Math.min(currentChangeIndex.value + 1, diffChangeCount.value - 1)
  }

  function prevChange() {
    if (diffChangeCount.value === 0) return
    currentChangeIndex.value = Math.max(currentChangeIndex.value - 1, 0)
  }

  function enrich(rev: DocRevisionListItem): DocRevisionListItem {
    if (!rev.created_by || !activeProjectId.value) return rev
    const map = basesUser.value.get(activeProjectId.value)
    const u = map?.find((m: any) => m.id === rev.created_by || m.email === rev.created_by)
    return {
      ...rev,
      created_by_display_name: u?.display_name || u?.email,
      created_by_email: u?.email,
      created_by_meta: (u as any)?.meta ?? null,
    }
  }

  async function loadRevisions(docId: string, opts: { append?: boolean } = {}) {
    if (!isUIAllowed('documentRevisionList')) return
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      isLoading.value = true
      if (!opts.append) {
        activeDocId.value = docId
        revisions.value = []
        nextCursor.value = null
      }

      const res = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'documentRevisionList',
        docId,
        ...(opts.append && nextCursor.value ? { before: nextCursor.value } : {}),
      })) as { list: DocRevisionListItem[]; nextCursor: string; retentionDays: number | null }

      const incoming = (res?.list || []).map(enrich)
      revisions.value = opts.append ? [...revisions.value, ...incoming] : incoming
      nextCursor.value = res?.nextCursor || null
      hasMore.value = !!res?.nextCursor
      retentionDays.value = res?.retentionDays ?? null

      $e('a:doc:history:list', { append: !!opts.append, count: incoming.length })
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore() {
    if (!activeDocId.value || !hasMore.value || isLoading.value) return
    await loadRevisions(activeDocId.value, { append: true })
  }

  async function fetchRevisionContent(revisionId: string): Promise<DocRevisionFull | null> {
    if (!activeDocId.value || !activeWorkspaceId.value || !activeProjectId.value) return null
    try {
      const res = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'documentRevisionGet',
        docId: activeDocId.value,
        revisionId,
      })) as DocRevisionFull
      // The single-revision endpoint returns the raw `created_by` user id —
      // run it through the same enrichment as list items so the header in
      // the viewer pane shows the author's display name + avatar meta.
      return { ...res, ...enrich(res) }
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  /**
   * Resolve which revision to compare against — always the chronologically
   * prior revision (next in the list, since revisions are sorted DESC).
   * Returns null when the selected revision is the oldest one available.
   */
  function resolveComparisonRevisionId(selectedId: string): string | null {
    const idx = revisions.value.findIndex((r) => r.id === selectedId)
    if (idx < 0) return null
    const prev = revisions.value[idx + 1]
    return prev?.id ?? null
  }

  // Monotonic ticket — incremented on each selectRevision call so that a
  // late-arriving fetch from a superseded click can't overwrite the content
  // shown for the newly-selected revision.
  let selectionSeq = 0

  async function refreshComparisonContent(seq?: number) {
    if (!selectedRevisionId.value) {
      comparisonContent.value = null
      comparisonTitle.value = null
      return
    }
    const compareId = resolveComparisonRevisionId(selectedRevisionId.value)
    if (!compareId) {
      comparisonContent.value = null
      comparisonTitle.value = null
      return
    }
    const rev = await fetchRevisionContent(compareId)
    // Bail if a newer selection superseded this fetch — otherwise the
    // comparison content for revision A could land after revision B is
    // already showing.
    if (seq !== undefined && seq !== selectionSeq) return
    comparisonContent.value = rev?.content ?? null
    comparisonTitle.value = rev?.title ?? null
  }

  async function selectRevision(revisionId: string | null) {
    const seq = ++selectionSeq
    selectedRevisionId.value = revisionId
    selectedRevisionContent.value = null
    comparisonContent.value = null
    comparisonTitle.value = null
    diffChangeCount.value = 0
    currentChangeIndex.value = 0

    if (!revisionId || !activeDocId.value) return

    try {
      isLoadingSelected.value = true
      const res = await fetchRevisionContent(revisionId)
      if (seq !== selectionSeq) return
      if (!res) {
        selectedRevisionId.value = null
        return
      }
      selectedRevisionContent.value = res
      // Kick off comparison fetch in parallel — the viewer can render
      // without it; diff highlights pop in when it lands.
      refreshComparisonContent(seq)
    } finally {
      if (seq === selectionSeq) isLoadingSelected.value = false
    }
  }

  async function restoreRevision(revisionId: string): Promise<boolean> {
    if (!activeDocId.value) return false
    if (!activeWorkspaceId.value || !activeProjectId.value) return false
    if (!isUIAllowed('documentRevisionRestore')) {
      message.error('You do not have permission to restore revisions')
      return false
    }

    try {
      isRestoring.value = true
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'documentRevisionRestore' },
        { docId: activeDocId.value, revisionId },
      )) as { id: string; version?: number; updated_at?: string; updated_by?: string; title?: string } | undefined

      // Patch the documents store so `activeDocument.version` jumps past the
      // editor's local version. The realtime broadcast can't fix this for
      // the restoring user because their own socket id is excluded from
      // the echo on the backend.
      if (updated?.id) {
        const baseDocs = documents.value.get(activeProjectId.value) || []
        const existing = baseDocs.find((d) => d.id === updated.id)
        if (existing) {
          if (updated.version !== undefined) existing.version = updated.version
          if (updated.updated_at !== undefined) existing.updated_at = updated.updated_at
          if (updated.updated_by !== undefined) existing.updated_by = updated.updated_by
          if (updated.title !== undefined) existing.title = updated.title
        }

        // Force the editor to reload its content from the server. We can't
        // rely on the auto-reload watcher in useDocumentAutoSave: it bails
        // out when the user has unsaved edits or a pending debounced save,
        // both of which are common right before opening the history panel.
        // Without this signal the editor's stale local PM state would be
        // sent by the next autosave, silently overwriting the restored
        // content.
        restoredHook.trigger({ docId: updated.id })
      }

      // Refresh the list to surface the new RESTORE revision at the top.
      await loadRevisions(activeDocId.value)
      selectedRevisionId.value = null
      selectedRevisionContent.value = null
      return true
    } catch (e: any) {
      // 422 is the optimistic-concurrency reject — another tab or user
      // edited the doc between the panel opening and the restore click.
      // Refresh the list so the user sees the new state on the retry; the
      // backend message ("Document has been modified by another user…")
      // already tells them what to do.
      if (e?.response?.status === 422 && activeDocId.value) {
        await loadRevisions(activeDocId.value)
      }
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    } finally {
      isRestoring.value = false
    }
  }

  function reset() {
    // Bump the selection seq so any in-flight selectRevision fetch bails
    // before writing back into the just-cleared state. Cheap, defensive.
    selectionSeq++
    activeDocId.value = null
    revisions.value = []
    nextCursor.value = null
    hasMore.value = false
    selectedRevisionId.value = null
    selectedRevisionContent.value = null
    comparisonContent.value = null
    comparisonTitle.value = null
    diffChangeCount.value = 0
    currentChangeIndex.value = 0
    retentionDays.value = null
  }

  return {
    activeDocId,
    revisions,
    isLoading,
    hasMore,
    selectedRevisionId,
    selectedRevisionContent,
    isLoadingSelected,
    isRestoring,
    comparisonContent,
    comparisonTitle,
    diffChangeCount,
    currentChangeIndex,
    retentionDays,
    loadRevisions,
    loadMore,
    selectRevision,
    restoreRevision,
    onRestored: restoredHook.on,
    nextChange,
    prevChange,
    reset,
    currentUserId: computed(() => user.value?.id),
  }
})

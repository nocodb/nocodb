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
  const { $api } = useNuxtApp()
  const basesStore = useBases()
  const { basesUser } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())
  const { activeProjectId } = storeToRefs(useBases())

  const activeDocId = ref<string | null>(null)
  const revisions = ref<DocRevisionListItem[]>([])
  const isLoading = ref(false)
  const hasMore = ref(false)
  const nextCursor = ref<string | null>(null)

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

  // Step-through nav state. `diffChangeCount` is written by the Viewer
  // whenever the diff is recomputed; `currentChangeIndex` is driven by
  // the modal's ↑/↓ buttons. The Viewer watches the index and scrolls
  // its editor accordingly.
  const diffChangeCount = ref(0)
  const currentChangeIndex = ref(0)

  function nextChange() {
    if (diffChangeCount.value === 0) return
    currentChangeIndex.value = Math.min(
      currentChangeIndex.value + 1,
      diffChangeCount.value - 1,
    )
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

      const res = (await $api.internal.getOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'documentRevisionList',
          docId,
          ...(opts.append && nextCursor.value ? { before: nextCursor.value } : {}),
        },
      )) as { list: DocRevisionListItem[]; nextCursor: string }

      const incoming = (res?.list || []).map(enrich)
      revisions.value = opts.append ? [...revisions.value, ...incoming] : incoming
      nextCursor.value = res?.nextCursor || null
      hasMore.value = !!res?.nextCursor
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
      const res = (await $api.internal.getOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'documentRevisionGet',
          docId: activeDocId.value,
          revisionId,
        },
      )) as DocRevisionFull
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

  async function refreshComparisonContent() {
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
    comparisonContent.value = rev?.content ?? null
    comparisonTitle.value = rev?.title ?? null
  }

  async function selectRevision(revisionId: string | null) {
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
      if (!res) {
        selectedRevisionId.value = null
        return
      }
      selectedRevisionContent.value = res
      // Kick off comparison fetch in parallel — the viewer can render
      // without it; diff highlights pop in when it lands.
      refreshComparisonContent()
    } finally {
      isLoadingSelected.value = false
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
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'documentRevisionRestore' },
        { docId: activeDocId.value, revisionId },
      )
      // Refresh the list to surface the new RESTORE revision at the top.
      await loadRevisions(activeDocId.value)
      selectedRevisionId.value = null
      selectedRevisionContent.value = null
      return true
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return false
    } finally {
      isRestoring.value = false
    }
  }

  function reset() {
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
    loadRevisions,
    loadMore,
    selectRevision,
    restoreRevision,
    nextChange,
    prevChange,
    reset,
    currentUserId: computed(() => user.value?.id),
  }
})

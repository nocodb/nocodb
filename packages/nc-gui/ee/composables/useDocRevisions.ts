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

  // Diff state — paired with the selected revision. `comparisonContent` is
  // fetched lazily based on `comparisonBasis`. `highlightChanges` drives the
  // toggle in the panel header.
  const comparisonBasis = ref<'previous' | 'current'>('previous')
  const comparisonContent = ref<Record<string, any> | null>(null)
  const highlightChanges = ref(true)

  function enrich(rev: DocRevisionListItem): DocRevisionListItem {
    if (!rev.created_by || !activeProjectId.value) return rev
    const map = basesUser.value.get(activeProjectId.value)
    const u = map?.find((m: any) => m.id === rev.created_by || m.email === rev.created_by)
    return {
      ...rev,
      created_by_display_name: u?.display_name || u?.email,
      created_by_email: u?.email,
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
      return (await $api.internal.getOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        {
          operation: 'documentRevisionGet',
          docId: activeDocId.value,
          revisionId,
        },
      )) as DocRevisionFull
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
      return null
    }
  }

  /**
   * Resolve which revision to compare against, based on the current basis
   * and the selected revision's position in the list. Returns null when no
   * comparison is possible (e.g. oldest revision + basis=previous).
   */
  function resolveComparisonRevisionId(selectedId: string): string | null {
    const idx = revisions.value.findIndex((r) => r.id === selectedId)
    if (idx < 0) return null

    if (comparisonBasis.value === 'current') {
      // "Current" = the newest entry in the list. Don't diff against itself.
      const current = revisions.value[0]
      if (!current || current.id === selectedId) return null
      return current.id
    }

    // basis === 'previous' — the chronologically older neighbor (next in
    // the list, since it's sorted DESC). Skip when selected is the oldest.
    const prev = revisions.value[idx + 1]
    return prev?.id ?? null
  }

  async function refreshComparisonContent() {
    if (!selectedRevisionId.value) {
      comparisonContent.value = null
      return
    }
    const compareId = resolveComparisonRevisionId(selectedRevisionId.value)
    if (!compareId) {
      comparisonContent.value = null
      return
    }
    const rev = await fetchRevisionContent(compareId)
    comparisonContent.value = rev?.content ?? null
  }

  async function selectRevision(revisionId: string | null) {
    selectedRevisionId.value = revisionId
    selectedRevisionContent.value = null
    comparisonContent.value = null

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

  function setComparisonBasis(basis: 'previous' | 'current') {
    if (comparisonBasis.value === basis) return
    comparisonBasis.value = basis
    refreshComparisonContent()
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
    comparisonBasis.value = 'previous'
    highlightChanges.value = true
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
    comparisonBasis,
    comparisonContent,
    highlightChanges,
    loadRevisions,
    loadMore,
    selectRevision,
    restoreRevision,
    setComparisonBasis,
    reset,
    currentUserId: computed(() => user.value?.id),
  }
})

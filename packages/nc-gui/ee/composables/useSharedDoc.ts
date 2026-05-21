import type {
  PublicDocChildNode,
  PublicDocChildrenResponse,
  PublicDocContentResponse,
  PublicDocLiteNode,
  PublicDocMetaResponse,
} from 'nocodb-sdk'

/**
 * HTTP status read off a fetch error. Logging the status (rather than
 * silently swallowing) lets the page distinguish revoke (404) from a
 * transient server error or network blip without exposing the underlying
 * error object to the user.
 */
function readErrorStatus(e: unknown): number | undefined {
  const err = e as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return err?.response?.status ?? err?.status ?? err?.statusCode
}

/**
 * Public reader composable for shared docs. Sibling to useSharedView — owns:
 *   - initial manifest fetch (root + direct children)
 *   - lazy children fetch on sidebar expand
 *   - lite ancestor lookup for the deep-link walker
 *   - per-doc content fetch on navigation
 *
 * Plain `ref` so each `/doc/<uuid>` page mount gets a fresh instance and two
 * concurrent shares opened in separate tabs don't share state.
 */
export function useSharedDoc() {
  const { appInfo } = useGlobal()

  const meta = ref<PublicDocMetaResponse | null>(null)
  const activeContent = ref<PublicDocContentResponse | null>(null)
  const isLoading = ref(false)
  // Any failure on /meta or /content (revoked share, 404, 5xx, network) flips
  // this to true so the page can render the same not-found empty state
  // shared-view shows on broken view URLs.
  const notFound = ref(false)

  // Lazy-load bookkeeping for the sidebar tree. Mirrors the in-app docs
  // store's loadedParentIds / loadingParentIds so the public reader expands
  // nodes the same way the authed sidebar does.
  const loadedParentIds = ref<Set<string>>(new Set())
  const loadingParentIds = ref<Set<string>>(new Set())

  const baseUrl = computed(() => appInfo.value?.ncSiteUrl?.replace(/\/$/, '') ?? '')

  const logFetchFailure = (where: string, e: unknown) => {
    const status = readErrorStatus(e)
    // 404 is expected (revoked / unknown UUID) — keep it on `info`. Other
    // failures get `warn` so they're greppable in dev tools without
    // tripping production noise filters.
    if (status === 404) {
      console.info(`[shared-doc] ${where} returned 404`, { status })
    } else {
      console.warn(`[shared-doc] ${where} failed`, { status, error: e })
    }
  }

  const loadMeta = async (uuid: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const res = await $fetch<PublicDocMetaResponse>(`${baseUrl.value}/api/v2/public/shared-doc/${uuid}/meta`)
      meta.value = res
      // The root's direct children are part of the initial manifest, so
      // mark the root as already loaded — no follow-up /children call when
      // the user expands it.
      loadedParentIds.value = new Set([res.root.id])
      loadingParentIds.value = new Set()
      notFound.value = false
      return true
    } catch (e) {
      // Revoked share, bad uuid, 5xx, network — surface the same generic
      // empty state shared-view uses instead of an infinite spinner.
      logFetchFailure('loadMeta', e)
      notFound.value = true
      return false
    } finally {
      isLoading.value = false
    }
  }

  const loadDoc = async (uuid: string, docId: string): Promise<boolean> => {
    isLoading.value = true
    try {
      const res = await $fetch<PublicDocContentResponse>(`${baseUrl.value}/api/v2/public/shared-doc/${uuid}/doc/${docId}/content`)
      activeContent.value = res
      notFound.value = false
      return true
    } catch (e) {
      logFetchFailure('loadDoc', e)
      notFound.value = true
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch direct children of `parentDocId` and merge them into `meta.tree`.
   * No-op if children for that parent are already loaded or currently
   * loading. Expansion failures keep the parent un-loaded so a future
   * collapse+expand retries; the page-wide notFound state is intentionally
   * not touched here — one branch failing shouldn't tear down the reader.
   */
  const loadChildren = async (uuid: string, parentDocId: string): Promise<void> => {
    if (!meta.value) return
    if (loadedParentIds.value.has(parentDocId)) return
    if (loadingParentIds.value.has(parentDocId)) return

    loadingParentIds.value = new Set([...loadingParentIds.value, parentDocId])
    try {
      const children = await $fetch<PublicDocChildrenResponse>(
        `${baseUrl.value}/api/v2/public/shared-doc/${uuid}/children/${parentDocId}`,
      )
      if (ncIsArray(children) && meta.value) {
        const existingIds = new Set(meta.value.tree.map((n) => n.id))
        const fresh = (children as PublicDocChildNode[]).filter((c) => !existingIds.has(c.id))
        if (fresh.length) {
          meta.value = { ...meta.value, tree: [...meta.value.tree, ...fresh] }
        }
      }
      loadedParentIds.value = new Set([...loadedParentIds.value, parentDocId])
    } catch (e) {
      logFetchFailure('loadChildren', e)
    } finally {
      const next = new Set(loadingParentIds.value)
      next.delete(parentDocId)
      loadingParentIds.value = next
    }
  }

  const isLoadingChildren = (parentDocId: string) => loadingParentIds.value.has(parentDocId)
  const areChildrenLoaded = (parentDocId: string) => loadedParentIds.value.has(parentDocId)

  /**
   * Fetch a single doc's tree-shape metadata via the `/lite` endpoint
   * (no content blob). Mirrors the in-app `documentGet` call used inside
   * `useDocumentsStore.expandToDocument` — the public reader uses this to
   * walk the parent chain on deep-link so the sidebar can pre-expand the
   * path to the active sub-document. Returns `null` on 404 / 5xx so callers
   * can stop the walk without tearing down the page.
   *
   * Adds the fetched node to `meta.tree` (de-duped) so the sidebar tree
   * walker can render it once siblings are loaded.
   */
  const fetchDocInfo = async (uuid: string, docId: string): Promise<PublicDocChildNode | null> => {
    if (!meta.value) return null
    try {
      const res = await $fetch<PublicDocLiteNode>(`${baseUrl.value}/api/v2/public/shared-doc/${uuid}/doc/${docId}/lite`)
      const node: PublicDocChildNode = {
        id: res.id,
        title: res.title || 'Untitled',
        icon: res.icon ?? null,
        // The share root is re-anchored to null server-side; cast keeps the
        // PublicDocChildNode shape (non-null parent_id) for non-root docs.
        parent_id: (res.parent_id ?? null) as unknown as string,
        order: res.order ?? 0,
        has_children: !!res.has_children,
      }
      if (meta.value && !meta.value.tree.some((n) => n.id === node.id)) {
        meta.value = { ...meta.value, tree: [...meta.value.tree, node] }
      }
      return node
    } catch (e) {
      logFetchFailure('fetchDocInfo', e)
      return null
    }
  }

  return {
    meta,
    activeContent,
    isLoading,
    notFound,
    loadMeta,
    loadDoc,
    loadChildren,
    fetchDocInfo,
    isLoadingChildren,
    areChildrenLoaded,
  }
}

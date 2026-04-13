import type { DocumentType } from 'nocodb-sdk'
import { NcErrorType } from 'nocodb-sdk'

export interface DocTreeNode {
  doc: DocumentType
  children: DocTreeNode[]
}

/**
 * Pinia store for Documents.
 *
 * Manages a per-base list of documents, tracks the active document for editor routing,
 * and provides CRUD + reorder operations via the internal API.
 *
 * Uses lazy loading (Notion pattern): root docs are fetched initially, children
 * are loaded on-demand when the user expands a parent node.
 */
export const useDocumentsStore = defineStore('documentsStore', () => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const { refreshCommandPalette } = useCommandPalette()

  const { isEEFeatureBlocked } = useEeConfig()

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  // State — flat list per base, tree built client-side from parent_id references
  const documents = ref<Map<string, DocumentType[]>>(new Map())
  const activeDocumentId = ref<string>()
  const isLoadingDocuments = ref(false)
  // Tracks which docs are expanded (children visible). Starts empty = all collapsed.
  const expandedDocIds = ref<Set<string>>(new Set())

  // Track which parent IDs have been loaded (lazy loading)
  // 'root:{baseId}' = root docs loaded for that base
  // '{docId}' = children of that doc loaded
  const loadedParentIds = ref<Set<string>>(new Set())
  const loadingParentIds = ref<Set<string>>(new Set())

  // Computed
  const activeDocuments = computed(() => {
    if (!activeProjectId.value) return []
    return documents.value.get(activeProjectId.value) || []
  })

  const documentTree = computed<DocTreeNode[]>(() => {
    const docs = activeDocuments.value
    if (!docs.length) return []

    // Group by parent_id
    const childrenMap = new Map<string | null, DocumentType[]>()
    for (const doc of docs) {
      const parentKey = doc.parent_id ?? null
      const group = childrenMap.get(parentKey) || []
      group.push(doc)
      childrenMap.set(parentKey, group)
    }

    // Build tree recursively from roots (parent_id = null)
    const buildLevel = (parentId: string | null): DocTreeNode[] => {
      const siblings = childrenMap.get(parentId) || []
      return siblings
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((doc) => ({
          doc,
          children: buildLevel(doc.id!),
        }))
    }

    return buildLevel(null)
  })

  const activeDocument = computed(() => {
    if (!activeDocumentId.value || !activeProjectId.value) return null
    const baseDocuments = documents.value.get(activeProjectId.value) || []
    return baseDocuments.find((d) => d.id === activeDocumentId.value) || null
  })

  // Actions

  /**
   * Load root documents for a base (parent_id = null).
   * This is the initial load — children are fetched lazily on expand.
   */
  const loadDocuments = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    if (isEEFeatureBlocked.value) return []

    const rootKey = `root:${baseId}`

    if (!force && loadedParentIds.value.has(rootKey)) {
      return documents.value.get(baseId) || []
    }

    try {
      isLoadingDocuments.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'documentList',
        parent_id: 'null',
      })) as DocumentType[]

      if (ncIsArray(response)) {
        // When force-reloading, clear child-loading markers so they re-fetch on expand
        if (force) {
          const oldDocs = documents.value.get(baseId) || []
          for (const d of oldDocs) {
            if (d.id) loadedParentIds.value.delete(d.id)
          }
        }
        documents.value.set(baseId, response)
        loadedParentIds.value.add(rootKey)
        return response
      } else {
        return []
      }
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoadingDocuments.value = false
    }
  }

  /**
   * Load children of a specific document (lazy load on expand).
   * Fetched children are merged into the flat document list.
   */
  const loadChildren = async (baseId: string, parentDocId: string) => {
    if (isEEFeatureBlocked.value) return
    if (loadedParentIds.value.has(parentDocId)) return
    if (loadingParentIds.value.has(parentDocId)) return

    try {
      loadingParentIds.value.add(parentDocId)

      const children = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'documentList',
        parent_id: parentDocId,
      })) as DocumentType[]

      if (ncIsArray(children)) {
        const baseDocuments = documents.value.get(baseId) || []

        // Merge children into flat list (avoid duplicates)
        const existingIds = new Set(baseDocuments.map((d) => d.id))
        for (const child of children) {
          if (!existingIds.has(child.id)) {
            baseDocuments.push(child)
          }
        }

        documents.value.set(baseId, baseDocuments)
      }

      loadedParentIds.value.add(parentDocId)
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
    } finally {
      loadingParentIds.value.delete(parentDocId)
    }
  }

  /**
   * Expand a document node — loads children if not yet fetched, then un-collapses.
   */
  const expandDocument = async (baseId: string, docId: string) => {
    // Load children if not yet loaded
    await loadChildren(baseId, docId)

    // Mark as expanded
    if (!expandedDocIds.value.has(docId)) {
      expandedDocIds.value.add(docId)
      expandedDocIds.value = new Set(expandedDocIds.value)
    }
  }

  /** Check if children are currently being fetched for a doc */
  const isLoadingChildren = (docId: string) => loadingParentIds.value.has(docId)

  const loadDocument = async (docId: string, showLoader = true) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return null

    try {
      if (showLoader) {
        isLoadingDocuments.value = true
      }

      const doc = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'documentGet',
        docId,
      })) as DocumentType

      // Add a lite version (without content) to the store so activeDocument
      // resolves and sidebar auto-expand works on page reload.
      if (doc?.id) {
        const baseId = activeProjectId.value
        const baseDocs = documents.value.get(baseId) || []
        if (!baseDocs.find((d) => d.id === doc.id)) {
          const { content: _content, ...liteDoc } = doc
          baseDocs.push(liteDoc as DocumentType)
          documents.value.set(baseId, [...baseDocs])
        }
      }

      return doc
    } catch (_e) {
      // Return null — Editor.vue renders the "Document Not Found" error page
      return null
    } finally {
      if (showLoader) {
        isLoadingDocuments.value = false
      }
    }
  }

  const createDocument = async (baseId: string, payload?: Partial<DocumentType>) => {
    if (isEEFeatureBlocked.value || !activeWorkspaceId.value) return null

    try {
      const created = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'documentCreate' },
        payload || {},
      )) as DocumentType

      if (!created?.id) {
        throw new Error(t('msg.failedToCreateDocument'))
      }

      const baseDocuments = documents.value.get(baseId) || []
      baseDocuments.push(created)
      documents.value.set(baseId, baseDocuments)

      // If creating a sub-document, mark the parent as having children and auto-expand
      if (payload?.parent_id) {
        const parent = baseDocuments.find((d) => d.id === payload.parent_id)
        if (parent) {
          parent.has_children = true
        }

        // Auto-expand so the new child is visible (Notion pattern)
        if (!expandedDocIds.value.has(payload.parent_id)) {
          expandedDocIds.value.add(payload.parent_id)
          expandedDocIds.value = new Set(expandedDocIds.value)
        }
      }

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId,
        docId: created.id,
        docTitle: created.title,
      })

      // Scroll the newly created document into view in the sidebar
      setTimeout(() => {
        const newDocDom = document.querySelector(`[data-testid="nc-docs-sidebar-pages-list"] [data-id="${created.id}"]`)
        if (newDocDom) {
          newDocDom.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 1000)

      await refreshCommandPalette()
      $e('a:document:create')

      return created
    } catch (e: any) {
      const errorInfo = await extractSdkResponseErrorMsgv2(e)

      const { isPaymentEnabled, showDocumentPagePlanLimitExceededModal } = useEeConfig()

      if (isPaymentEnabled.value && errorInfo.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
        showDocumentPagePlanLimitExceededModal()
      } else {
        ncMessage.error(errorInfo.message)
      }

      return null
    }
  }

  const updateDocument = async (baseId: string, docId: string, updates: Partial<DocumentType>) => {
    if (!activeWorkspaceId.value) return null

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'documentUpdate' },
        { ...updates, docId },
      )) as DocumentType

      // Patch the existing document in place to avoid replacing the entire array
      // which would trigger reactivity on every sidebar node during auto-save.
      // Only sidebar-visible fields (version, timestamps, title) are synced —
      // `content` and `meta` are intentionally NOT patched here because the
      // sidebar list doesn't use them (listLite excludes content), and the
      // editor maintains its own copy via the Tiptap document model.
      const baseDocuments = documents.value.get(baseId) || []
      const existing = baseDocuments.find((d) => d.id === docId)

      if (existing) {
        existing.version = updated.version
        existing.updated_at = updated.updated_at
        existing.updated_by = updated.updated_by
        if (updates.title !== undefined) {
          existing.title = updated.title
        }
        if (updates.meta !== undefined) {
          existing.meta = updated.meta
        }
      }

      $e('a:document:update')

      return updated
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const setActiveDocumentId = (id: string | undefined) => {
    activeDocumentId.value = id
  }

  const deleteDocument = async (baseId: string, docId: string) => {
    if (!activeWorkspaceId.value) return false

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, baseId, { operation: 'documentDelete' }, { docId })

      // Collect all loaded descendant IDs for local removal (backend cascade soft-deletes them)
      const idsToRemove = new Set<string>([docId])
      const collectDescendants = (parentId: string) => {
        const baseDocuments = documents.value.get(baseId) || []
        for (const d of baseDocuments) {
          if (d.parent_id === parentId && d.id && !idsToRemove.has(d.id)) {
            idsToRemove.add(d.id)
            collectDescendants(d.id)
          }
        }
      }
      collectDescendants(docId)

      const baseDocuments = documents.value.get(baseId) || []

      // Update parent's has_children before removing
      const deletedDoc = baseDocuments.find((d) => d.id === docId)
      if (deletedDoc?.parent_id) {
        const parent = baseDocuments.find((d) => d.id === deletedDoc.parent_id)
        if (parent) {
          const remainingSiblings = baseDocuments.some((d) => d.parent_id === deletedDoc.parent_id && !idsToRemove.has(d.id!))
          parent.has_children = remainingSiblings
        }
      }

      const filtered = baseDocuments.filter((d) => !idsToRemove.has(d.id!))
      documents.value.set(baseId, filtered)

      // Clean up loaded parent tracking for removed docs
      for (const id of idsToRemove) {
        loadedParentIds.value.delete(id)
      }

      // If the deleted document (or any descendant) was active, navigate to a
      // sibling/neighbor doc so the user stays in docs — not the data section.
      if (activeDocumentId.value && idsToRemove.has(activeDocumentId.value)) {
        setActiveDocumentId(undefined)

        // Pick a remaining sibling (same parent), or fall back to any remaining doc
        const deletedParentId = deletedDoc?.parent_id ?? null
        const sibling = filtered.find((d) => (d.parent_id ?? null) === deletedParentId)
        const nextDoc = sibling || filtered[0]

        if (nextDoc?.id) {
          ncNavigateTo({
            workspaceId: activeWorkspaceId.value,
            baseId,
            docId: nextDoc.id,
            docTitle: nextDoc.title,
          })
        } else {
          // No documents left — navigate to docs landing page
          router.push(`/${activeWorkspaceId.value}/${baseId}/docs`)
        }
      }

      await refreshCommandPalette()
      $e('a:document:delete')

      return true
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const reorderDocument = async (baseId: string, docId: string, order: number) => {
    if (!activeWorkspaceId.value) return null

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'documentReorder' },
        { docId, order },
      )) as DocumentType

      const baseDocuments = documents.value.get(baseId) || []
      const index = baseDocuments.findIndex((d) => d.id === docId)

      if (index !== -1) {
        baseDocuments[index].order = order
        // Re-sort by order
        baseDocuments.sort((a, b) => (a.order || 0) - (b.order || 0))
        documents.value.set(baseId, [...baseDocuments])
      }

      $e('a:document:reorder')
      return updated
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const toggleCollapse = (docId: string) => {
    if (expandedDocIds.value.has(docId)) {
      expandedDocIds.value.delete(docId)
    } else {
      expandedDocIds.value.add(docId)
    }
    // Trigger reactivity
    expandedDocIds.value = new Set(expandedDocIds.value)
  }

  const isCollapsed = (docId: string) => !expandedDocIds.value.has(docId)

  const moveDocument = async (baseId: string, docId: string, parentId: string | null, order: number) => {
    if (!activeWorkspaceId.value) return null

    const baseDocuments = documents.value.get(baseId) || []
    const existing = baseDocuments.find((d) => d.id === docId)
    if (!existing) return null

    // Save old values for rollback
    const oldParentId = existing.parent_id
    const oldOrder = existing.order
    const oldParent = oldParentId ? baseDocuments.find((d) => d.id === oldParentId) : null
    const oldParentHadChildren = oldParent?.has_children
    const newParent = parentId ? baseDocuments.find((d) => d.id === parentId) : null
    const newParentHadChildren = newParent?.has_children

    // Optimistic local update — Vue re-renders immediately from new state,
    // preventing duplicates that occur when SortableJS DOM and Vue VDOM disagree.
    existing.parent_id = parentId
    existing.order = order

    if (newParent) newParent.has_children = true

    if (parentId) {
      // Auto-expand the target parent so the nested child is visible (Notion pattern)
      if (!expandedDocIds.value.has(parentId)) {
        expandedDocIds.value.add(parentId)
        expandedDocIds.value = new Set(expandedDocIds.value)
      }
    }

    // Update old parent's has_children (may no longer have children)
    if (oldParent && oldParentId !== parentId) {
      const remainingChildren = baseDocuments.some((d) => d.parent_id === oldParentId && d.id !== docId)
      oldParent.has_children = remainingChildren
    }

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'documentReorder' },
        { docId, order, parent_id: parentId },
      )) as DocumentType

      $e('a:document:move')
      return updated
    } catch (e) {
      // Rollback on failure — restore all optimistic changes
      existing.parent_id = oldParentId
      existing.order = oldOrder
      if (oldParent) oldParent.has_children = oldParentHadChildren
      if (newParent) newParent.has_children = newParentHadChildren
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  // Auto-expand: when a doc is active, expand it and all its ancestors in sidebar
  const expandToDocument = async (doc: DocumentType) => {
    if (!activeProjectId.value || !doc.id) return

    const baseId = activeProjectId.value

    // Ensure root docs are loaded first (handles page reload)
    await loadDocuments({ baseId })

    const getBaseDocs = () => documents.value.get(baseId) || []

    let changed = false

    // Expand the active doc if it has children
    if (doc.has_children && !expandedDocIds.value.has(doc.id)) {
      await loadChildren(baseId, doc.id)
      expandedDocIds.value.add(doc.id)
      changed = true
    }

    // Build the full ancestor chain bottom-up, fetching missing parents as needed.
    // Each missing parent is fetched individually (documentGet) and added to the
    // store (without content) so the sidebar tree can render it.
    let parentId: string | null | undefined = doc.parent_id
    while (parentId) {
      let parent = getBaseDocs().find((d) => d.id === parentId)

      // Parent not in store — fetch it and add lite version
      if (!parent) {
        try {
          const fetched = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
            operation: 'documentGet',
            docId: parentId,
          })) as DocumentType

          if (fetched?.id) {
            const { content: _content, ...liteDoc } = fetched
            const baseDocs = getBaseDocs()
            baseDocs.push(liteDoc as DocumentType)
            documents.value.set(baseId, [...baseDocs])
            parent = liteDoc as DocumentType
          }
        } catch {
          break
        }
      }

      if (!expandedDocIds.value.has(parentId)) {
        expandedDocIds.value.add(parentId)
        changed = true
      }

      // Ensure parent's children are loaded (lightweight — no content)
      if (!loadedParentIds.value.has(parentId)) {
        await loadChildren(baseId, parentId)
      }

      parentId = parent?.parent_id
    }

    if (changed) {
      expandedDocIds.value = new Set(expandedDocIds.value)
    }
  }

  // Watch activeDocument (not activeDocumentId) — this fires after the Editor
  // loads the doc, so we always have the parent_id chain available without
  // needing to fetch the full doc separately.
  watch(activeDocument, (doc) => {
    if (!doc) return
    expandToDocument(doc)
  })

  // --- URL slug sync (mirrors Script store pattern) ---

  const activeDocumentUrlSlug = computed(() => {
    return route.params.slugs?.[0] || ''
  })

  const activeDocumentReadableUrlSlug = computed(() => {
    if (!activeDocument.value) return ''

    return toReadableUrlSlug([activeDocument.value.title])
  })

  /**
   * Keeps the browser URL slug in sync with the document's readable slug.
   * Triggers only when:
   * - The current browser URL slug is missing, OR
   * - The browser URL slug does not match the document's readable slug.
   */
  watch(
    [activeDocumentReadableUrlSlug, activeDocumentUrlSlug],
    ([newActiveDocumentReadableUrlSlug, newActiveDocumentUrlSlug]) => {
      if (!newActiveDocumentReadableUrlSlug || newActiveDocumentUrlSlug === newActiveDocumentReadableUrlSlug) return

      const slugs = (route.params.slugs as string[]) || []

      const newSlug = [newActiveDocumentReadableUrlSlug]

      if (slugs.length > 1) {
        newSlug.push(...slugs.slice(1))
      }

      router.replace({
        name: 'index-typeOrId-baseId-index-docs-docId-slugs',
        params: {
          ...route.params,
          slugs: newSlug,
        },
        query: route.query,
        force: true,
      })
    },
    {
      immediate: true,
      flush: 'post',
    },
  )

  /**
   * Returns the ancestor chain for a document (from root to immediate parent).
   * Useful for breadcrumb rendering.
   */
  const getDocumentAncestors = (docId: string): DocumentType[] => {
    if (!activeProjectId.value) return []
    const baseDocs = documents.value.get(activeProjectId.value) || []
    const ancestors: DocumentType[] = []

    const current = baseDocs.find((d) => d.id === docId)
    let parentId = current?.parent_id

    while (parentId) {
      const parent = baseDocs.find((d) => d.id === parentId)
      if (!parent) break
      ancestors.unshift(parent)
      parentId = parent.parent_id
    }

    return ancestors
  }

  /**
   * Refresh has_permissions flags on all loaded documents without disrupting the tree.
   * Called when a realtime document_permission_update event is received.
   */
  const refreshDocPermissions = async (baseId: string) => {
    const baseDocs = documents.value.get(baseId)
    if (!baseDocs?.length) return

    // Collect all loaded parent IDs (root + expanded children)
    const parentIds = new Set<string | null>()
    const rootKey = `root:${baseId}`
    if (loadedParentIds.value.has(rootKey)) parentIds.add(null)
    for (const doc of baseDocs) {
      if (doc.id && loadedParentIds.value.has(doc.id)) parentIds.add(doc.id)
    }

    // Re-fetch each loaded level and update has_permissions in place
    for (const parentId of parentIds) {
      try {
        const freshDocs = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
          operation: 'documentList',
          parent_id: parentId === null ? 'null' : parentId,
        })) as DocumentType[]

        if (ncIsArray(freshDocs)) {
          const freshById = new Map(freshDocs.map((d) => [d.id, d]))
          for (const doc of baseDocs) {
            const fresh = freshById.get(doc.id)
            if (fresh) {
              doc.has_permissions = fresh.has_permissions
            }
          }
        }
      } catch {
        // Silently ignore — non-critical refresh
      }
    }
  }

  /**
   * All documents for a base (flat list). Separate from the sidebar's lazy-loaded
   * `documents` map to avoid clobbering tree state (expandedDocIds, loadedParentIds).
   * Used by the permissions settings page.
   */
  const allDocuments = ref<DocumentType[]>([])

  /**
   * Load ALL documents for a base in a single API call (flat list, no content).
   * Used by the permissions settings page to avoid recursive tree expansion.
   */
  const loadAllDocuments = async (baseId: string) => {
    const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
      operation: 'documentListAll',
    })) as DocumentType[]

    if (ncIsArray(response)) {
      allDocuments.value = response
    }

    return response || []
  }

  return {
    documents,
    activeDocumentId,
    isLoadingDocuments,
    activeDocuments,
    activeDocument,
    documentTree,
    expandedDocIds,
    loadedParentIds,
    loadingParentIds,
    toggleCollapse,
    isCollapsed,
    expandDocument,
    isLoadingChildren,
    setActiveDocumentId,
    loadDocuments,
    loadChildren,
    allDocuments,
    loadDocument,
    loadAllDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    reorderDocument,
    moveDocument,
    getDocumentAncestors,
    refreshDocPermissions,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentsStore as any, import.meta.hot))
}

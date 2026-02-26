import type { DocumentType } from 'nocodb-sdk'

/**
 * Pinia store for Documents.
 *
 * Manages a per-base list of documents, tracks the active document for editor routing,
 * and provides CRUD + reorder operations via the internal API.
 */
export const useDocumentsStore = defineStore('documentsStore', () => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()
  const { ncNavigateTo } = useGlobal()
  const { refreshCommandPalette } = useCommandPalette()

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  // State
  const documents = ref<Map<string, DocumentType[]>>(new Map())
  const activeDocumentId = ref<string>()
  const isLoadingDocuments = ref(false)

  // Computed
  const activeDocuments = computed(() => {
    if (!activeProjectId.value) return []
    return documents.value.get(activeProjectId.value) || []
  })

  const activeDocument = computed(() => {
    if (!activeDocumentId.value || !activeProjectId.value) return null
    const baseDocuments = documents.value.get(activeProjectId.value) || []
    return baseDocuments.find((d) => d.id === activeDocumentId.value) || null
  })

  // Actions
  const loadDocuments = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    const existingDocuments = documents.value.get(baseId)

    // Return cached list immediately without toggling isLoadingDocuments —
    // avoids a flash of loading state when navigating between documents.
    // Use .length check: an empty array is truthy in JS and would
    // prevent re-fetching when another user has since created documents.
    if (existingDocuments?.length && !force) {
      return existingDocuments
    }

    try {
      isLoadingDocuments.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'documentList',
      })) as DocumentType[]

      if (ncIsArray(response)) {
        documents.value.set(baseId, response)
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

      return doc
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
      })
      return null
    } finally {
      if (showLoader) {
        isLoadingDocuments.value = false
      }
    }
  }

  const createDocument = async (baseId: string, payload?: Partial<DocumentType>) => {
    if (!activeWorkspaceId.value) return null

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

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId,
        docId: created.id,
        docTitle: created.title,
      })

      await refreshCommandPalette()
      $e('a:document:create')

      return created
    } catch (e) {
      ncMessage.error(await extractSdkResponseErrorMsgv2(e as any))
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

      const baseDocuments = documents.value.get(baseId) || []
      const filtered = baseDocuments.filter((d) => d.id !== docId)
      documents.value.set(baseId, filtered)

      // If the deleted document was active, navigate away
      if (activeDocumentId.value === docId) {
        setActiveDocumentId(undefined)
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId,
        })
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

  return {
    documents,
    activeDocumentId,
    isLoadingDocuments,
    activeDocuments,
    activeDocument,
    setActiveDocumentId,
    loadDocuments,
    loadDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    reorderDocument,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocumentsStore as any, import.meta.hot))
}

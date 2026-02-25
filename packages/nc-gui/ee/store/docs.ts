import { defineStore } from 'pinia'
import type { DocType } from 'nocodb-sdk'

/**
 * Pinia store for Pages (internally "Docs").
 *
 * Manages a per-base list of docs, tracks the active doc for editor routing,
 * and provides CRUD + reorder operations via the internal API.
 */
export const useDocsStore = defineStore('docsStore', () => {
  const { $api, $e } = useNuxtApp()
  const { t } = useI18n()
  const { ncNavigateTo } = useGlobal()
  const { refreshCommandPalette } = useCommandPalette()

  const basesStore = useBases()
  const { activeProjectId } = storeToRefs(basesStore)
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  // State
  const docs = ref<Map<string, DocType[]>>(new Map())
  const activeDocId = ref<string>()
  const isLoadingDocs = ref(false)

  // Computed
  const activeDocs = computed(() => {
    if (!activeProjectId.value) return []
    return docs.value.get(activeProjectId.value) || []
  })

  const activeDoc = computed(() => {
    if (!activeDocId.value || !activeProjectId.value) return null
    const baseDocs = docs.value.get(activeProjectId.value) || []
    return baseDocs.find((d) => d.id === activeDocId.value) || null
  })

  // Actions
  const loadDocs = async ({ baseId, force = false }: { baseId: string; force?: boolean }) => {
    const existingDocs = docs.value.get(baseId)

    // Return cached list immediately without toggling isLoadingDocs —
    // avoids a flash of loading state when navigating between docs.
    if (existingDocs && !force) {
      return existingDocs
    }

    try {
      isLoadingDocs.value = true

      const response = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
        operation: 'docList',
      })) as DocType[]

      if (ncIsArray(response)) {
        docs.value.set(baseId, response)
        return response
      } else {
        return []
      }
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    } finally {
      isLoadingDocs.value = false
    }
  }

  const loadDoc = async (docId: string, showLoader = true) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return null

    try {
      if (showLoader) {
        isLoadingDocs.value = true
      }

      const doc = (await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'docGet',
        docId,
      })) as DocType

      return doc
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: activeProjectId.value,
      })
      return null
    } finally {
      if (showLoader) {
        isLoadingDocs.value = false
      }
    }
  }

  const createDoc = async (baseId: string, payload?: Partial<DocType>) => {
    if (!activeWorkspaceId.value) return null

    try {
      const created = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'docCreate' },
        payload || {},
      )) as DocType

      if (!created?.id) {
        throw new Error(t('msg.failedToCreatePage'))
      }

      const baseDocs = docs.value.get(baseId) || []
      baseDocs.push(created)
      docs.value.set(baseId, baseDocs)

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId,
        docId: created.id,
        docTitle: created.title,
      })

      await refreshCommandPalette()
      $e('a:doc:create')

      return created
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const updateDoc = async (baseId: string, docId: string, updates: Partial<DocType>) => {
    if (!activeWorkspaceId.value) return null

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'docUpdate' },
        { ...updates, docId },
      )) as DocType

      // Patch the existing doc in place to avoid replacing the entire array
      // which would trigger reactivity on every sidebar node during auto-save.
      // Only sidebar-visible fields (version, timestamps, title) are synced —
      // `content` and `meta` are intentionally NOT patched here because the
      // sidebar list doesn't use them (listLite excludes content), and the
      // editor maintains its own copy via the Tiptap document model.
      const baseDocs = docs.value.get(baseId) || []
      const existing = baseDocs.find((d) => d.id === docId)

      if (existing) {
        existing.version = updated.version
        existing.updated_at = updated.updated_at
        existing.updated_by = updated.updated_by
        if (updates.title !== undefined) {
          existing.title = updated.title
        }
      }

      $e('a:doc:update')

      return updated
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteDoc = async (baseId: string, docId: string) => {
    if (!activeWorkspaceId.value) return false

    try {
      await $api.internal.postOperation(activeWorkspaceId.value, baseId, { operation: 'docDelete' }, { docId })

      const baseDocs = docs.value.get(baseId) || []
      const filtered = baseDocs.filter((d) => d.id !== docId)
      docs.value.set(baseId, filtered)

      // If the deleted doc was active, navigate away
      if (activeDocId.value === docId) {
        setActiveDocId(undefined)
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId,
        })
      }

      await refreshCommandPalette()
      $e('a:doc:delete')

      return true
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const reorderDoc = async (baseId: string, docId: string, order: number) => {
    if (!activeWorkspaceId.value) return null

    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        baseId,
        { operation: 'docReorder' },
        { docId, order },
      )) as DocType

      const baseDocs = docs.value.get(baseId) || []
      const index = baseDocs.findIndex((d) => d.id === docId)

      if (index !== -1) {
        baseDocs[index].order = order
        // Re-sort by order
        baseDocs.sort((a, b) => (a.order || 0) - (b.order || 0))
        docs.value.set(baseId, [...baseDocs])
      }

      $e('a:doc:reorder')
      return updated
    } catch (e) {
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const setActiveDocId = (id: string | undefined) => {
    activeDocId.value = id
  }

  return {
    docs,
    activeDocId,
    isLoadingDocs,
    activeDocs,
    activeDoc,
    setActiveDocId,
    loadDocs,
    loadDoc,
    createDoc,
    updateDoc,
    deleteDoc,
    reorderDoc,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocsStore as any, import.meta.hot))
}

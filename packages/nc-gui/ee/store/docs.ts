import { defineStore } from 'pinia'
import type { DocType } from 'nocodb-sdk'

export const useDocsStore = defineStore('docsStore', () => {
  const { $api, $e } = useNuxtApp()
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
      console.error(e)
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
      })) as unknown as DocType

      return doc
    } catch (e) {
      console.error(e)
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
        console.error('[docs] docCreate returned invalid response:', created)
        throw new Error('Failed to create page')
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
      console.error(e)
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

      const baseDocs = docs.value.get(baseId) || []
      const index = baseDocs.findIndex((d) => d.id === docId)

      if (index !== -1) {
        const updatedDocs = [...baseDocs]
        updatedDocs[index] = { ...baseDocs[index], ...updated }
        docs.value.set(baseId, updatedDocs)
      }

      await refreshCommandPalette()
      $e('a:doc:update')

      return updated
    } catch (e) {
      console.error(e)
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
        activeDocId.value = undefined
        ncNavigateTo({
          workspaceId: activeWorkspaceId.value,
          baseId,
        })
      }

      await refreshCommandPalette()
      $e('a:doc:delete')

      return true
    } catch (e) {
      console.error(e)
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
      console.error(e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  return {
    docs,
    activeDocId,
    isLoadingDocs,
    activeDocs,
    activeDoc,
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

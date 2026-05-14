import { type ViewSectionType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewSectionsStore = defineStore('viewSections', () => {
  const { $api } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeTableId, activeTable } = storeToRefs(useTablesStore())

  const sectionsByKey = ref<Map<string, ViewSectionType>>(new Map())

  /** Compose the storage key for a section. */
  const composeKey = (baseId: string, sectionId: string) => `${baseId}:${sectionId}`

  /** Section ID that should be expanded on next render (set after move-to-section) */
  const pendingExpandSectionId = ref<string | null>(null)

  const requestSectionExpand = (sectionId: string) => {
    pendingExpandSectionId.value = sectionId
  }

  const clearPendingExpand = () => {
    pendingExpandSectionId.value = null
  }

  /** Get sections for a specific table, sorted by `order`. */
  const getSections = (baseId: string, tableId: string): ViewSectionType[] => {
    if (!baseId || !tableId) {
      console.warn('[getSections] baseId and tableId are required')
      return []
    }
    const out: ViewSectionType[] = []
    for (const s of sectionsByKey.value.values()) {
      if (s.base_id === baseId && s.fk_model_id === tableId) out.push(s)
    }
    return out.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  /** Has at least one section been loaded for this table? */
  const hasSectionsForTable = (baseId: string, tableId: string) => {
    for (const s of sectionsByKey.value.values()) {
      if (s.base_id === baseId && s.fk_model_id === tableId) return true
    }
    return false
  }

  /** Lookup a single section by composite (baseId, sectionId). */
  const getSection = (baseId: string, sectionId: string): ViewSectionType | undefined => {
    return sectionsByKey.value.get(composeKey(baseId, sectionId))
  }

  const loadSections = async ({ tableId, baseId, force }: { tableId?: string; baseId?: string; force?: boolean } = {}) => {
    const effectiveTableId = tableId || activeTableId.value
    const effectiveBaseId = baseId || activeTable.value?.base_id

    if (!effectiveBaseId || !effectiveTableId) {
      console.warn('[loadSections] baseId and tableId are required')
      return
    }

    if (!force && hasSectionsForTable(effectiveBaseId, effectiveTableId)) {
      return getSections(effectiveBaseId, effectiveTableId)
    }

    try {
      const response = await $api.instance.get(`/api/v2/internal/${activeWorkspaceId.value}/${effectiveBaseId}`, {
        params: { operation: 'viewSectionList', tableId: effectiveTableId },
      })

      if (response.data?.list) {
        const list = response.data.list as ViewSectionType[]
        // Drop any prior entries for this table to keep the map authoritative.
        for (const [key, s] of sectionsByKey.value) {
          if (s.base_id === effectiveBaseId && s.fk_model_id === effectiveTableId) {
            sectionsByKey.value.delete(key)
          }
        }
        for (const s of list) {
          if (s.id && s.base_id) sectionsByKey.value.set(composeKey(s.base_id, s.id), s)
        }
        return getSections(effectiveBaseId, effectiveTableId)
      }

      return []
    } catch (e: any) {
      console.error('[loadSections]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    }
  }

  const createSection = async (
    baseId: string,
    tableId: string,
    data: { title: string; order?: number; meta?: Record<string, any> },
  ) => {
    if (!baseId || !tableId) return null

    try {
      const response = await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionCreate&tableId=${tableId}`,
        data,
      )

      const section = response.data as ViewSectionType

      if (section?.id && section.base_id) {
        sectionsByKey.value.set(composeKey(section.base_id, section.id), section)
        return section
      }

      return null
    } catch (e: any) {
      console.error('[createSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const updateSection = async (
    baseId: string,
    sectionId: string,
    data: { title?: string; order?: number; meta?: Record<string, any> },
  ) => {
    if (!baseId || !sectionId) return null

    try {
      const response = await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionUpdate&sectionId=${sectionId}`,
        data,
      )

      const updatedSection = response.data as ViewSectionType

      if (updatedSection?.id && updatedSection.base_id) {
        sectionsByKey.value.set(composeKey(updatedSection.base_id, updatedSection.id), updatedSection)
        return updatedSection
      }

      return null
    } catch (e: any) {
      console.error('[updateSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteSection = async (baseId: string, sectionId: string) => {
    if (!baseId || !sectionId) return false

    try {
      await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionDelete&sectionId=${sectionId}`,
      )

      sectionsByKey.value.delete(composeKey(baseId, sectionId))

      return true
    } catch (e: any) {
      console.error('[deleteSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const reorderSection = async (baseId: string, sectionId: string, newOrder: number) => {
    return updateSection(baseId, sectionId, { order: newOrder })
  }

  /** Generate a unique default section title like "View section", "View section 2", etc. */
  const getNextSectionTitle = (baseId: string, tableId: string) => {
    const baseName = 'View section'
    const currentSections = getSections(baseId, tableId)
    const existingTitles = new Set(currentSections.map((s) => s.title?.trim()))

    if (!existingTitles.has(baseName)) return baseName

    let counter = 2
    while (existingTitles.has(`${baseName} ${counter}`)) {
      counter++
    }
    return `${baseName} ${counter}`
  }

  /**
   * High-level action: create a new section for a table and auto-expand it.
   * Computes the next order from existing sections + provided view orders.
   * Used by CreateViewBtn/SectionMenu and Views/index.vue.
   */
  const createSectionForTable = async (baseId: string, tableId: string, viewOrders: number[] = []) => {
    if (!baseId || !tableId) return null

    const sections = getSections(baseId, tableId)
    const lastOrder = Math.max(...sections.map((s) => s.order || 0), ...viewOrders, 0)

    const section = await createSection(baseId, tableId, {
      title: getNextSectionTitle(baseId, tableId),
      order: lastOrder + 1,
    })

    if (section?.id) {
      requestSectionExpand(section.id)
    }

    return section
  }

  /**
   * Realtime apply hooks — called from `useRealtime` when the backend
   * broadcasts section events. Keeping these as named methods (rather
   * than direct map mutations) means the single source of truth stays
   * consistent across every write path.
   */
  const applySectionCreated = (section: ViewSectionType) => {
    if (!section?.id || !section.base_id) return
    sectionsByKey.value.set(composeKey(section.base_id, section.id), section)
  }

  const applySectionUpdated = (section: ViewSectionType) => {
    if (!section?.id || !section.base_id) return
    const key = composeKey(section.base_id, section.id)
    const existing = sectionsByKey.value.get(key)
    sectionsByKey.value.set(key, existing ? { ...existing, ...section } : section)
  }

  const applySectionDeleted = (baseId: string, sectionId: string) => {
    if (!baseId || !sectionId) return
    sectionsByKey.value.delete(composeKey(baseId, sectionId))
  }

  return {
    // State
    sectionsByKey,
    pendingExpandSectionId,

    // Getters
    getSections,
    getSection,
    hasSectionsForTable,

    // Actions
    loadSections,
    createSection,
    createSectionForTable,
    updateSection,
    deleteSection,
    reorderSection,
    getNextSectionTitle,
    requestSectionExpand,
    clearPendingExpand,

    // Realtime apply hooks
    applySectionCreated,
    applySectionUpdated,
    applySectionDeleted,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewSectionsStore, import.meta.hot))
}

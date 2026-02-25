import { type ViewSectionType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewSectionsStore = defineStore('viewSections', () => {
  const { $api } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeTableId, activeTable } = storeToRefs(useTablesStore())

  // Helper function to create composite key: baseId:tableId
  const getSectionsKey = (baseId: string, tableId: string) => `${baseId}:${tableId}`

  // State
  const sectionsByTable = ref<Map<string, ViewSectionType[]>>(new Map())

  // Reverse index: sectionId -> table key for O(1) lookups
  const sectionTableIndex = ref<Map<string, string>>(new Map())

  /**
   * Get sections for a specific table
   */
  const getSections = (baseId: string, tableId: string): ViewSectionType[] => {
    if (!baseId || !tableId) {
      console.warn('[getSections] baseId and tableId are required')
      return []
    }

    const key = getSectionsKey(baseId, tableId)
    return sectionsByTable.value.get(key) ?? []
  }

  const loadSections = async ({
    tableId,
    baseId,
    force,
  }: { tableId?: string; baseId?: string; force?: boolean } = {}) => {
    const effectiveTableId = tableId || activeTableId.value
    const effectiveBaseId = baseId || activeTable.value?.base_id

    if (!effectiveBaseId || !effectiveTableId) {
      console.warn('[loadSections] baseId and tableId are required')
      return
    }

    const key = getSectionsKey(effectiveBaseId, effectiveTableId)

    if (!force && sectionsByTable.value.get(key)) {
      return sectionsByTable.value.get(key)
    }

    try {
      const response = await $api.instance.get(
        `/api/v2/internal/${activeWorkspaceId.value}/${effectiveBaseId}`,
        { params: { operation: 'viewSectionList', tableId: effectiveTableId } },
      )

      if (response.data?.list) {
        const sortedSections = (response.data.list as ViewSectionType[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        sectionsByTable.value.set(key, sortedSections)

        for (const s of sortedSections) {
          if (s.id) sectionTableIndex.value.set(s.id, key)
        }

        return sortedSections
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

      if (section && section.id) {
        const key = getSectionsKey(baseId, tableId)
        const currentSections = sectionsByTable.value.get(key) || []
        const updatedSections = [...currentSections, section].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        sectionsByTable.value.set(key, updatedSections)

        sectionTableIndex.value.set(section.id, key)

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
    sectionId: string,
    data: { title?: string; order?: number; meta?: Record<string, any> },
  ) => {
    if (!sectionId) return null

    const tableKey = sectionTableIndex.value.get(sectionId)
    if (!tableKey) {
      console.error('[updateSection] Section not found in index:', sectionId)
      return null
    }

    const [baseId] = tableKey.split(':')

    try {
      const response = await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionUpdate&sectionId=${sectionId}`,
        data,
      )

      const updatedSection = response.data as ViewSectionType

      if (updatedSection && updatedSection.id) {
        const sections = sectionsByTable.value.get(tableKey)
        if (sections) {
          const index = sections.findIndex((s) => s.id === sectionId)
          if (index !== -1) {
            sections[index] = updatedSection
            sectionsByTable.value.set(tableKey, [...sections])
          }
        }

        return updatedSection
      }

      return null
    } catch (e: any) {
      console.error('[updateSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
  }

  const deleteSection = async (sectionId: string) => {
    if (!sectionId) return false

    const tableKey = sectionTableIndex.value.get(sectionId)
    if (!tableKey) {
      console.error('[deleteSection] Section not found in index:', sectionId)
      return false
    }

    const [baseId] = tableKey.split(':')

    try {
      await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionDelete&sectionId=${sectionId}`,
      )

      const sections = sectionsByTable.value.get(tableKey)
      if (sections) {
        sectionsByTable.value.set(tableKey, sections.filter((s) => s.id !== sectionId))
      }
      sectionTableIndex.value.delete(sectionId)

      return true
    } catch (e: any) {
      console.error('[deleteSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const reorderSection = async (sectionId: string, newOrder: number) => {
    if (!sectionId) return null

    const tableKey = sectionTableIndex.value.get(sectionId)
    if (!tableKey) {
      console.error('[reorderSection] Section not found in index:', sectionId)
      return null
    }

    const [baseId] = tableKey.split(':')

    try {
      const response = await $api.instance.post(
        `/api/v2/internal/${activeWorkspaceId.value}/${baseId}?operation=viewSectionUpdate&sectionId=${sectionId}`,
        { order: newOrder },
      )

      const updatedSection = response.data as ViewSectionType

      if (updatedSection && updatedSection.id) {
        const sections = sectionsByTable.value.get(tableKey)
        if (sections) {
          const index = sections.findIndex((s) => s.id === sectionId)
          if (index !== -1) {
            sections[index] = updatedSection
            sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            sectionsByTable.value.set(tableKey, [...sections])
          }
        }

        return updatedSection
      }

      return null
    } catch (e: any) {
      console.error('[reorderSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return null
    }
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

  return {
    // State
    sectionsByTable,

    // Getters
    getSections,

    // Actions
    loadSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSection,
    getNextSectionTitle,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewSectionsStore, import.meta.hot))
}

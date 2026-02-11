import { type ViewSectionType } from 'nocodb-sdk'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useViewSectionsStore = defineStore('viewSections', () => {
  const { $api } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeTableId } = storeToRefs(useTablesStore())

  const { activeTable } = storeToRefs(useTablesStore())

  // Helper function to create composite key: baseId:tableId
  const getSectionsKey = (baseId: string, tableId: string) => `${baseId}:${tableId}`

  // State
  const sectionsByTable = ref<Map<string, ViewSectionType[]>>(new Map())

  // Computed properties
  const sections = computed({
    get: () => {
      if (!activeTableId.value || !activeTable.value?.base_id) return []

      const key = getSectionsKey(activeTable.value.base_id, activeTableId.value)
      return sectionsByTable.value.get(key) ?? []
    },
    set: (value) => {
      if (!activeTableId.value || !activeTable.value?.base_id) return

      const key = getSectionsKey(activeTable.value.base_id, activeTableId.value)
      if (!value) return sectionsByTable.value.delete(key)

      sectionsByTable.value.set(key, value)
    },
  })

  const loadSections = async ({
    tableId,
    baseId,
    ignoreLoading,
    force,
  }: { tableId?: string; baseId?: string; ignoreLoading?: boolean; force?: boolean } = {}) => {
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
        `/api/v1/db/meta/tables/${effectiveTableId}/view-sections`,
      )

      if (response.data?.list) {
        const sortedSections = (response.data.list as ViewSectionType[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        sectionsByTable.value.set(key, sortedSections)
        return sortedSections
      }

      return []
    } catch (e: any) {
      console.error('[loadSections]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return []
    }
  }

  const createSection = async (tableId: string, data: { title: string; order?: number; meta?: Record<string, any> }) => {
    if (!tableId || !activeTable.value?.base_id) return null

    try {
      const response = await $api.instance.post(
        `/api/v1/db/meta/tables/${tableId}/view-sections`,
        data,
      )

      const section = response.data as ViewSectionType
      const baseId = activeTable.value.base_id

      if (section && section.id) {
        const key = getSectionsKey(baseId, tableId)
        const currentSections = sectionsByTable.value.get(key) || []
        const updatedSections = [...currentSections, section].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        sectionsByTable.value.set(key, updatedSections)

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

    try {
      const response = await $api.instance.patch(
        `/api/v1/db/meta/view-sections/${sectionId}`,
        data,
      )

      const updatedSection = response.data as ViewSectionType

      if (updatedSection && updatedSection.id) {
        // Update all matching sections in all tables
        for (const [key, sections] of sectionsByTable.value) {
          const index = sections.findIndex((s) => s.id === sectionId)
          if (index !== -1) {
            sections[index] = updatedSection
            sectionsByTable.value.set(key, [...sections])
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

    try {
      await $api.instance.delete(`/api/v1/db/meta/view-sections/${sectionId}`)

      // Remove section from all tables
      for (const [key, sections] of sectionsByTable.value) {
        const filtered = sections.filter((s) => s.id !== sectionId)
        sectionsByTable.value.set(key, filtered)
      }

      return true
    } catch (e: any) {
      console.error('[deleteSection]', e)
      message.error(await extractSdkResponseErrorMsgv2(e as any))
      return false
    }
  }

  const reorderSection = async (sectionId: string, newOrder: number) => {
    if (!sectionId) return null

    try {
      const response = await $api.instance.patch(
        `/api/v1/db/meta/view-sections/${sectionId}`,
        { order: newOrder },
      )

      const updatedSection = response.data as ViewSectionType

      if (updatedSection && updatedSection.id) {
        // Update all matching sections in all tables
        for (const [key, sections] of sectionsByTable.value) {
          const index = sections.findIndex((s) => s.id === sectionId)
          if (index !== -1) {
            sections[index] = updatedSection
            sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            sectionsByTable.value.set(key, [...sections])
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
  const getNextSectionTitle = () => {
    const baseName = 'View section'
    const existingTitles = new Set(sections.value.map((s) => s.title?.trim()))

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
    sections,

    // Actions
    loadSections,
    createSection,
    updateSection,
    deleteSection,
    reorderSection,
    getNextSectionTitle,
  }
})

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useViewSectionsStore, import.meta.hot))
}

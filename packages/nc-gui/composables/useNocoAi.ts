import type { TableType } from 'nocodb-sdk'

export const useNocoAi = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const aiIntegrationAvailable = ref(true)

  const aiLoading = ref(false)

  const callAiApi = async (operation: string, input: any, customBaseId?: string) => {
    const baseId = customBaseId || activeProjectId.value

    if (!aiIntegrationAvailable.value || !baseId) {
      return
    }

    aiLoading.value = true

    const res = await $api.ai.utils(baseId, { operation, input })

    aiLoading.value = false

    return res
  }

  const predictFieldType = async (title: string) => {
    const res = await callAiApi('predictFieldType', title)

    if (res.type) {
      return res.type
    }
  }

  const predictSelectOptions = async (title: string, tableId: string, history?: string[]) => {
    const res = await callAiApi('predictSelectOptions', { title, tableId, history })

    if (res.options) {
      return res.options
    }
  }

  const predictNextFields = async (tableId: string, history?: string[]) => {
    const res = await callAiApi('predictNextFields', { tableId, history })

    if (res.fields) {
      return res.fields
    }
  }

  const predictNextFormulas = async (tableId: string, history?: string[]) => {
    const res = await callAiApi('predictNextFormulas', { tableId, history })

    if (res.formulas) {
      return res.formulas
    }
  }

  const generateTables = async (title: string[], description?: string, onTableCreate?: (firstTableMeta: TableType) => void) => {
    try {
      const res = await callAiApi('generateTables', { title, description })

      if (res.length) {
        await onTableCreate?.(res[0])
      }
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const generateViews = async (tableId: string, onViewCreate?: () => void) => {
    try {
      await callAiApi('generateViews', {
        tableId,
      })

      await onViewCreate?.()
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const predictNextTables = async (history?: string[], baseId?: string) => {
    const res = await callAiApi('predictNextTables', { history }, baseId)

    if (res.tables) {
      return res.tables
    }
  }

  return {
    aiIntegrationAvailable,
    aiLoading,
    predictFieldType,
    predictSelectOptions,
    predictNextFields,
    predictNextFormulas,
    generateViews,
    predictNextTables,
    generateTables,
  }
})

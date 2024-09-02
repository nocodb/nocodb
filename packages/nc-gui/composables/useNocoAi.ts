import type { TableType } from 'nocodb-sdk'

export const useNocoAi = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const aiIntegrationAvailable = ref(true)

  const aiLoading = ref(false)

  const callAiApi = async (operation: string, input: any) => {
    if (!aiIntegrationAvailable.value || !activeProjectId.value) {
      return
    }

    aiLoading.value = true

    const res = await $api.ai.utils(activeProjectId.value, { operation, input })

    aiLoading.value = false

    return res
  }

  const predictFieldType = async (title: string) => {
    const res = await callAiApi('predictFieldType', title)

    if (res.type) {
      return res.type
    }
  }

  const predictSelectOptions = async (title: string, tableId: string) => {
    const res = await callAiApi('predictSelectOptions', { title, tableId })

    if (res.options) {
      return res.options
    }
  }

  const predictNextFields = async (tableId: string) => {
    const res = await callAiApi('predictNextFields', { tableId })

    if (res.fields) {
      return res.fields
    }
  }

  const predictNextFormulas = async (tableId: string) => {
    const res = await callAiApi('predictNextFormulas', { tableId })

    if (res.formulas) {
      return res.formulas
    }
  }

  const generateTable = async (title: string, description?: string, onTableCreate?: (tableMeta: TableType) => void) => {
    try {
      const res = await callAiApi('generateTable', { title, description })

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

  return {
    aiIntegrationAvailable,
    aiLoading,
    predictFieldType,
    predictSelectOptions,
    predictNextFields,
    predictNextFormulas,
    generateTable,
    generateViews,
  }
})

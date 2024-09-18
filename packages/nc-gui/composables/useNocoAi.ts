import type { TableType } from 'nocodb-sdk'

const aiIntegrationNotFound = 'AI integration not found'

export const useNocoAi = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const workspaceStore = useWorkspace()

  const { activeWorkspaceId } = storeToRefs(workspaceStore)

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const aiIntegrationAvailable = ref(true)

  const aiLoading = ref(false)

  const aiError = ref<string>('')

  const callAiUtilsApi = async (operation: string, input: any, customBaseId?: string, skipMsgToast = false) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      if (!aiIntegrationAvailable.value || !baseId) {
        return
      }

      aiLoading.value = true
      aiError.value = ''

      const res = await $api.ai.utils(baseId, { operation, input })

      return res
    } catch (e) {
      console.error(e)
      const error = await extractSdkResponseErrorMsg(e)

      if (error === aiIntegrationNotFound) {
        aiIntegrationAvailable.value = false
      } else {
        aiError.value = error
      }

      if (!skipMsgToast) {
        message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
      }
    } finally {
      aiLoading.value = false
    }
  }

  const callAiSchemaApi = async (operation: string, input: any, customBaseId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      if (!aiIntegrationAvailable.value || !baseId) {
        return
      }

      aiLoading.value = true

      const res = await $api.ai.schema(baseId, { operation, input })

      return res
    } catch (e) {
      console.error(e)
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    } finally {
      aiLoading.value = false
    }
  }

  const callAiSchemaCreateApi = async (operation: string, input: any) => {
    try {
      if (!aiIntegrationAvailable.value || !activeWorkspaceId.value) {
        return
      }

      aiLoading.value = true

      const res = await $api.ai.schemaCreate(activeWorkspaceId.value, { operation, input })

      return res
    } catch (e) {
      console.error(e)
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    } finally {
      aiLoading.value = false
    }
  }

  const predictFieldType = async (title: string, customBaseId?: string) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictFieldType', title, baseId)

    if (res?.type) {
      return res.type
    }
  }

  const predictSelectOptions = async (title: string, tableId: string, history?: string[], customBaseId?: string) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictSelectOptions', { title, tableId, history }, baseId)

    if (res?.options) {
      return res.options
    }
  }

  const predictNextFields = async (tableId: string, history?: string[], customBaseId?: string) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextFields', { tableId, history }, baseId)

    if (res?.fields) {
      return res.fields
    }
  }

  const predictNextFormulas = async (tableId: string, history?: string[], customBaseId?: string) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextFormulas', { tableId, history }, baseId)

    if (res?.formulas) {
      return res.formulas
    }
  }

  const generateTables = async (
    title: string[],
    description?: string,
    onTableCreate?: (firstTableMeta: TableType) => void,
    customBaseId?: string,
  ) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      const res = await callAiSchemaApi('generateTables', { title, description }, baseId)

      if (res?.length) {
        await onTableCreate?.(res[0])
      }
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const generateViews = async (tableId: string, onViewCreate?: () => void, customBaseId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      await callAiSchemaApi(
        'generateViews',
        {
          tableId,
        },
        baseId,
      )

      await onViewCreate?.()
    } catch (e: any) {
      console.error(e)
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const predictNextTables = async (history?: string[], baseId?: string, prompt?: string, skipMsgToast = true) => {
    const res = await callAiUtilsApi('predictNextTables', { history, prompt }, baseId, skipMsgToast)

    if (res?.tables) {
      return res.tables
    }

    return []
  }

  const generatingRows = ref<string[]>([])

  const generatingColumns = ref<string[]>([])

  const generateRows = async (modelId: string, columnId: string, rowIds: string[]) => {
    try {
      aiLoading.value = true

      const res = await $api.ai.dataGenerate(modelId, columnId, { rowIds })

      return res
    } catch (e) {
      console.error(e)
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    } finally {
      aiLoading.value = false
    }
  }

  const predictSchema = async (input: any) => {
    const res = await callAiSchemaCreateApi('predictSchema', input)

    return res
  }

  const createSchema = async (schema: any) => {
    const res = await callAiSchemaCreateApi('createSchema', schema)

    return res
  }

  return {
    aiIntegrationAvailable,
    aiLoading,
    aiError,
    predictFieldType,
    predictSelectOptions,
    predictNextFields,
    predictNextFormulas,
    generateViews,
    predictNextTables,
    generateTables,
    generateRows,
    generatingRows,
    generatingColumns,
    predictSchema,
    createSchema,
  }
})

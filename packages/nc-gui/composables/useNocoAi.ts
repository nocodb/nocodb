import { type IntegrationType, IntegrationsType, type SerializedAiViewType, type TableType } from 'nocodb-sdk'

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

  const aiIntegrations = ref<IntegrationType[]>([])

  const { listIntegrationByType } = useProvideIntegrationViewStore()

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
        message.warning(error)

        return
      } else {
        aiError.value = error
      }

      if (!skipMsgToast) {
        message.warning(error || 'NocoAI: Underlying GPT API are busy. Please try after sometime.')
      }
    } finally {
      aiLoading.value = false
    }
  }

  const callAiSchemaApi = async (operation: string, input: any, customBaseId?: string, skipMsgToast = false) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      if (!aiIntegrationAvailable.value || !baseId) {
        return
      }

      aiLoading.value = true
      aiError.value = ''

      const res = await $api.ai.schema(baseId, { operation, input })

      return res
    } catch (e) {
      console.error(e)
      const error = await extractSdkResponseErrorMsg(e)

      if (error === aiIntegrationNotFound) {
        message.warning(error)

        return
      } else {
        aiError.value = error
      }

      if (!skipMsgToast) {
        message.warning(error || 'NocoAI: Underlying GPT API are busy. Please try after sometime.')
      }
    } finally {
      aiLoading.value = false
    }
  }

  const callAiSchemaCreateApi = async (operation: string, input: any, skipMsgToast = false) => {
    try {
      if (!aiIntegrationAvailable.value || !activeWorkspaceId.value) {
        return
      }

      aiLoading.value = true
      aiError.value = ''

      const res = await $api.ai.schemaCreate(activeWorkspaceId.value, { operation, input })

      return res
    } catch (e) {
      console.error(e)
      const error = await extractSdkResponseErrorMsg(e)

      if (error === aiIntegrationNotFound) {
        message.warning(error)

        return
      } else {
        aiError.value = error
      }

      if (!skipMsgToast) {
        message.warning(error || 'NocoAI: Underlying GPT API are busy. Please try after sometime.')
      }
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

  const predictNextFields = async (
    tableId: string,
    history?: string[],
    customBaseId?: string,
    description?: string,
    skipMsgToast = true,
  ) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextFields', { tableId, history, description }, baseId, skipMsgToast)

    if (res?.fields) {
      return res.fields
    }

    return []
  }

  const predictNextFormulas = async (
    tableId: string,
    history?: string[],
    customBaseId?: string,
    description?: string,
    skipMsgToast = true,
  ) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextFormulas', { tableId, history, description }, baseId, skipMsgToast)

    if (res?.formulas) {
      return res.formulas
    }

    return []
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

  const createViews = async (views: SerializedAiViewType[], customBaseId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      const res = await callAiSchemaApi(
        'createViews',
        {
          views,
        },
        baseId,
      )

      return res
    } catch (e: any) {
      console.error(e)
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const predictNextTables = async (
    history?: string[],
    baseId?: string,
    prompt?: string,
    skipMsgToast = true,
  ): Promise<{ title: string; selected: boolean }[]> => {
    const res = await callAiUtilsApi('predictNextTables', { history, prompt }, baseId, skipMsgToast)

    if (res?.tables) {
      return res.tables.map((title: string) => ({
        title,
        selected: false,
      }))
    }

    return []
  }

  const predictViews = async (
    tableId: string,
    history?: any[],
    baseId?: string,
    description?: string,
    type?: string,
    skipMsgToast = true,
  ) => {
    const res = await callAiSchemaApi('predictViews', { tableId, history, description, type }, baseId, skipMsgToast)

    if (res?.views) {
      return res.views.map((view) => ({
        ...view,
        selected: false,
      }))
    }

    return []
  }

  const generatingRows = ref<string[]>([])

  const generatingColumnRows = ref<string[]>([])

  const generatingColumns = ref<string[]>([])

  const generateRows = async (
    modelId: string,
    column:
      | string
      | {
          title: string
          prompt_raw: string
          fk_integration_id: string
          uidt: string
          model?: string
          output_column_ids?: string
        },
    rowIds: string[],
    skipMsgToast = false,
    preview = false,
  ) => {
    try {
      aiLoading.value = true
      aiError.value = ''

      const res = await $api.ai.dataGenerate(modelId, { rowIds, column, preview })

      return res
    } catch (e) {
      console.error(e)
      const error = await extractSdkResponseErrorMsg(e)

      if (error === aiIntegrationNotFound) {
        message.warning(error)

        return
      } else {
        aiError.value = error
      }

      if (!skipMsgToast) {
        message.warning(error || 'NocoAI: Underlying GPT API are busy. Please try after sometime.')
      }
    } finally {
      aiLoading.value = false
    }
  }

  const predictSchema = async (input: any, skipMsgToast = true) => {
    const res = await callAiSchemaCreateApi('predictSchema', input, skipMsgToast)

    return res
  }

  const createSchema = async (schema: any, skipMsgToast = true) => {
    const res = await callAiSchemaCreateApi('createSchema', schema, skipMsgToast)

    return res
  }

  const predictFormula = async (input: string, oldFormula?: string) => {
    const res = await callAiUtilsApi('predictFormula', { input, formula: oldFormula?.length ? oldFormula : undefined })

    if (res?.formula) {
      return res.formula
    }
  }

  const repairFormula = async (oldFormula: string, error?: string) => {
    const res = await callAiUtilsApi('repairFormula', { formula: oldFormula, error })

    if (res?.formula) {
      return res.formula
    }
  }

  const loadAiIntegrations = async () => {
    aiIntegrations.value = (await listIntegrationByType(IntegrationsType.Ai)) || []

    if (aiIntegrations.value.length) {
      aiIntegrationAvailable.value = true
    } else {
      aiIntegrationAvailable.value = false
    }
  }

  onMounted(() => {
    loadAiIntegrations()
  })

  return {
    aiIntegrationAvailable,
    aiLoading,
    aiError,
    predictFieldType,
    predictSelectOptions,
    predictNextFields,
    predictNextFormulas,
    createViews,
    predictNextTables,
    generateTables,
    generateRows,
    generatingRows,
    generatingColumnRows,
    generatingColumns,
    predictSchema,
    createSchema,
    predictFormula,
    repairFormula,
    predictViews,
    aiIntegrations,
    loadAiIntegrations,
  }
})

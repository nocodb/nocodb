import { BaseVersion, type IntegrationType, type SerializedAiViewType, type TableType } from 'nocodb-sdk'

const aiIntegrationNotFound = 'AI integration not found'

export const useNocoAi = createSharedComposable(() => {
  const { $api, $poller } = useNuxtApp()

  const workspaceStore = useWorkspace()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const { appInfo } = useGlobal()

  const isAiFeaturesEnabled = computed(() => appInfo.value?.ee)

  const isAiBetaFeaturesEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.AI_BETA_FEATURES) && appInfo.value?.ee)

  const aiLoading = ref(false)

  const aiError = ref<string>('')

  const aiIntegrations = ref<Partial<IntegrationType>[]>([])

  const aiIntegrationAvailable = computed(() => !!aiIntegrations.value.length)

  const isNocoAiAvailable = computed(() => aiIntegrations.value.some((integration) => integration.id?.startsWith('global_')))

  const isAiIntegrationAvailableInList = (integrationId?: string) => {
    if (!aiIntegrationAvailable.value) return false

    return ncIsArrayIncludes(aiIntegrations.value, integrationId, 'id')
  }

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
      if (!aiIntegrationAvailable.value || !workspaceStore.activeWorkspaceId) {
        return
      }

      aiLoading.value = true
      aiError.value = ''

      const res = await $api.ai.schemaCreate(workspaceStore.activeWorkspaceId, {
        operation,
        input,
        ...(isFeatureEnabled(FEATURE_FLAG.BASES_V3) ? { version: BaseVersion.V3 } : {}),
      })

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
    unsupportedColumn: string[] = [],
    skipMsgToast = true,
  ) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi(
      'predictNextFields',
      { tableId, history, description, unsupportedColumn },
      baseId,
      skipMsgToast,
    )

    if (res?.fields) {
      return res.fields
    }

    return []
  }

  const completeScript = async (body: any) => {
    const res = await $api.ai.completion(activeProjectId.value, body)
    return res
  }

  const predictNextFormulas = async (
    tableId: string,
    history?: string[],
    customBaseId?: string,
    description?: string,
    _unsupportedColumn: string[] = [],
    skipMsgToast = true,
  ) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextFormulas', { tableId, history, description }, baseId, skipMsgToast)

    if (res?.formulas) {
      return res.formulas
    }

    return []
  }

  const predictNextButtons = async (
    tableId: string,
    history?: string[],
    customBaseId?: string,
    description?: string,
    _unsupportedColumn: string[] = [],
    skipMsgToast = true,
  ) => {
    const baseId = customBaseId || activeProjectId.value

    const res = await callAiUtilsApi('predictNextButtons', { tableId, history, description }, baseId, skipMsgToast)

    if (res?.buttons) {
      return res.buttons
    }

    return []
  }

  const generateTables = async (
    title: string[],
    description?: string,
    onTableCreate?: (firstTableMeta: TableType) => void,
    customBaseId?: string,
    sourceId?: string,
  ) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      const res = await callAiSchemaApi('generateTables', { title, description, sourceId }, baseId)

      if (res?.length) {
        await onTableCreate?.(res[0])
      }
    } catch (e: any) {
      message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
    }
  }

  const createViews = async (views: SerializedAiViewType[], customBaseId?: string, sourceId?: string) => {
    try {
      const baseId = customBaseId || activeProjectId.value

      const res = await callAiSchemaApi(
        'createViews',
        {
          views,
          sourceId,
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
    sourceId?: string,
    skipMsgToast = true,
  ): Promise<{ title: string; selected: boolean }[]> => {
    const res = await callAiUtilsApi('predictNextTables', { history, prompt, sourceId }, baseId, skipMsgToast)

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
    sourceId?: string,
    skipMsgToast = true,
  ) => {
    const res = await callAiSchemaApi('predictViews', { tableId, history, description, type, sourceId }, baseId, skipMsgToast)

    if (res?.views) {
      return res.views.map((view) => ({
        ...view,
        selected: false,
      }))
    }

    return []
  }

  /**
   * Predict filter conditions from a natural-language description using AI.
   * Calls the backend 'predictFilters' operation, which uses the table schema
   * to generate structured filters (column, operator, value, logical_op).
   *
   * Returns { action, filters } where:
   * - action: 'add' (append), 'replace' (clear + add), or 'clear' (remove all)
   * - filters: array of filter objects with column titles (not IDs) — the caller
   *   is responsible for resolving titles to fk_column_id before applying.
   */
  const predictFilters = async (
    tableId: string,
    description: string,
    viewId?: string,
    baseId?: string,
    skipMsgToast = true,
  ): Promise<{
    action: 'add' | 'replace' | 'clear'
    filters: {
      column: string
      comparison_op: string
      comparison_sub_op: string | null
      value: string | null
      logical_op: string
    }[]
  }> => {
    const res = await callAiSchemaApi('predictFilters', { tableId, viewId, description }, baseId, skipMsgToast)

    return {
      action: (res?.action as 'add' | 'replace' | 'clear') || 'add',
      filters:
        (res?.filters as {
          column: string
          comparison_op: string
          comparison_sub_op: string | null
          value: string | null
          logical_op: string
        }[]) || [],
    }
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
    meta?: { workspaceId?: string; baseId?: string },
  ) => {
    try {
      const workspaceId = meta?.workspaceId || workspaceStore.activeWorkspaceId
      const baseId = meta?.baseId || activeProjectId.value

      if (!workspaceId || !baseId) return

      aiLoading.value = true
      aiError.value = ''

      const res = await $api.internal.postOperation(
        workspaceId,
        baseId,
        { operation: 'aiDataGenerateRows' },
        { modelId, rowIds, column, preview },
      )

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

  const fillRows = async (
    modelId: string,
    body: {
      rows: any[]
      generateIds: string[]
      numRows: number
    },
    meta?: { workspaceId?: string; baseId?: string },
  ) => {
    const workspaceId = meta?.workspaceId || workspaceStore.activeWorkspaceId
    const baseId = meta?.baseId || activeProjectId.value

    if (!workspaceId || !baseId) return

    const res = await $api.internal.postOperation(workspaceId, baseId, { operation: 'aiDataFillRows' }, { modelId, ...body })

    return res as Record<string, any>[]
  }

  const predictSchema = async (input: any, skipMsgToast = true) => {
    const res = await callAiSchemaCreateApi('predictSchema', input, skipMsgToast)

    if (!res) return

    // If response has an `id` but no `tables`, it's a job ID — poll for result
    if (res.id && !res.tables) {
      // Keep loading state active during polling (callAiSchemaCreateApi resets it in finally)
      aiLoading.value = true

      const POLL_TIMEOUT_MS = 3 * 60 * 1000 // 3 minutes
      const topic = { id: res.id }

      return new Promise<any>((resolve, reject) => {
        let settled = false

        const timeoutId = setTimeout(() => {
          if (settled) return
          settled = true
          $poller.unsubscribe(topic)
          aiLoading.value = false
          const errorMsg = 'AI schema prediction timed out. Please try again.'
          aiError.value = errorMsg
          if (!skipMsgToast) {
            message.error(errorMsg)
          }
          reject(new Error(errorMsg))
        }, POLL_TIMEOUT_MS)

        $poller.subscribe(
          topic,
          (data: {
            id: string
            status?: string
            data?: {
              error?: { message: string }
              message?: string
              result?: any
            }
          }) => {
            if (data.status !== 'close') {
              if (data.status === JobStatus.COMPLETED) {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                aiLoading.value = false
                resolve(data.data?.result)
              } else if (data.status === JobStatus.FAILED) {
                if (settled) return
                settled = true
                clearTimeout(timeoutId)
                aiLoading.value = false
                const errorMsg = data.data?.error?.message || 'AI schema prediction failed'
                if (!skipMsgToast) {
                  message.error(errorMsg)
                }
                aiError.value = errorMsg
                reject(new Error(errorMsg))
              }
            }
          },
        )
      })
    }

    // Direct result (no Redis fallback) — return as-is
    return res
  }

  const createSchema = async (schema: any, skipMsgToast = true) => {
    const res = await callAiSchemaCreateApi('createSchema', schema, skipMsgToast)

    return res
  }

  const predictFormula = async (input: string, tableId?: string, oldFormula?: string) => {
    const res = await callAiUtilsApi('predictFormula', { input, tableId, formula: oldFormula?.length ? oldFormula : undefined })

    if (res?.formula) {
      return res.formula
    }
  }

  const repairFormula = async (oldFormula: string, tableId?: string, error?: string) => {
    const res = await callAiUtilsApi('repairFormula', { formula: oldFormula, error, tableId })

    if (res?.formula) {
      return res.formula
    }
  }

  return {
    aiIntegrationAvailable,
    isNocoAiAvailable,
    isAiIntegrationAvailableInList,
    aiLoading,
    aiError,
    predictFieldType,
    predictSelectOptions,
    predictNextFields,
    predictNextFormulas,
    predictNextButtons,
    createViews,
    predictNextTables,
    generateTables,
    generateRows,
    fillRows,
    generatingRows,
    generatingColumnRows,
    generatingColumns,
    predictSchema,
    createSchema,
    predictFormula,
    repairFormula,
    predictViews,
    predictFilters,
    aiIntegrations,
    completeScript,
    isAiFeaturesEnabled,
    isAiBetaFeaturesEnabled,
  }
})

import {
  BaseVersion,
  type ColumnType,
  type IntegrationType,
  SelectFieldAgentMetaProp,
  type SerializedAiViewType,
  type TableType,
  isFieldAgentCol,
} from 'nocodb-sdk'

const aiIntegrationNotFound = 'AI integration not found'

export const useNocoAi = createSharedComposable(() => {
  const { $api, $e, $poller } = useNuxtApp()

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
      const baseId = meta?.baseId || activeProjectId?.value || workspaceStore.activeProjectId?.value

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
    const baseId = meta?.baseId || activeProjectId?.value || workspaceStore.activeProjectId?.value

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

  // Canvas grid action manager hook: set by canvas grid, used by toolbar for
  // cell-level loading spinners during bulk AI generation.
  const canvasBulkAiGeneration = ref<
    ((columnId: string, rowIds: string[], rows?: Row[], path?: Array<number>) => Promise<any>) | null
  >(null)

  // ── Field Agent Dirty Row Tracking ──────────────────────────────────
  // Tracks which rows need re-generation because a dependent field changed.
  // Session-scoped: resets on page reload.

  /** Mutate a reactive Map ref and trigger Vue reactivity. */
  function reactiveMapSet<K, V>(mapRef: Ref<Map<K, V>>, key: K, value: V) {
    mapRef.value.set(key, value)
    triggerRef(mapRef)
  }

  function reactiveMapDelete<K, V>(mapRef: Ref<Map<K, V>>, key: K) {
    mapRef.value.delete(key)
    triggerRef(mapRef)
  }

  // Reverse dependency map: columnTitle → [fieldAgentColumnId, ...]
  const fieldAgentDependencyMap = ref<Map<string, string[]>>(new Map())

  // Dirty rows: fieldAgentColumnId → Set<rowPk>
  const dirtyFieldAgentRows = ref<Map<string, Set<string>>>(new Map())

  /**
   * Build reverse dependency map from field agent prompts.
   * Call whenever table columns change.
   */
  const buildFieldAgentDependencyMap = (columns: ColumnType[]) => {
    const newMap = new Map<string, string[]>()

    for (const col of columns) {
      if (!isFieldAgentCol(col) || !col.id) continue

      const colMeta = parseProp(col.meta)
      const promptRaw = colMeta?.[SelectFieldAgentMetaProp]?.prompt_raw
      if (!promptRaw) continue

      // Extract all {FieldName} tokens
      const matches = promptRaw.match(/\{([^}]+)\}/g)
      if (!matches) continue

      for (const match of matches) {
        const fieldName = match.slice(1, -1) // Remove { }
        const existing = newMap.get(fieldName) ?? []
        if (!existing.includes(col.id)) {
          existing.push(col.id)
        }
        newMap.set(fieldName, existing)
      }
    }

    fieldAgentDependencyMap.value = newMap
  }

  /**
   * Called after a cell update. Marks dependent field agent rows as dirty.
   * Also triggers a debounced server-side re-fetch for persistent tracking.
   */
  const onFieldAgentCellUpdate = (property: string, rowPk: string, modelId?: string) => {
    const dependentColIds = fieldAgentDependencyMap.value.get(property)
    if (!dependentColIds?.length) return

    for (const colId of dependentColIds) {
      let dirtySet = dirtyFieldAgentRows.value.get(colId)
      if (!dirtySet) {
        dirtySet = new Set()
        dirtyFieldAgentRows.value.set(colId, dirtySet)
      }
      dirtySet.add(rowPk)

      // Debounced server re-fetch for persistent tracking
      if (modelId) {
        debouncedFetchDirty(modelId, colId)
      }
    }

    triggerRef(dirtyFieldAgentRows)
  }

  // ── Server-Side Dirty Tracking (persistent via nc_row_meta) ──────────
  // Queries the backend for dirty rows; survives page reloads.

  const serverDirtyCounts = ref<Map<string, { count: number; rowIds: string[] }>>(new Map())
  const dirtyCountLoading = ref<Map<string, boolean>>(new Map())

  const fetchFieldAgentDirtyCount = async (modelId: string, colId: string) => {
    if (!modelId || !colId) return { count: 0, rowIds: [] }

    reactiveMapSet(dirtyCountLoading, colId, true)

    try {
      const data = (await $api.internal.getOperation(workspaceStore.activeWorkspaceId, activeProjectId?.value || workspaceStore.activeProjectId?.value || '', {
        operation: 'fieldAgentDirtyRows',
        tableId: modelId,
        columnId: colId,
      })) as { count: number; rowIds: string[] }
      reactiveMapSet(serverDirtyCounts, colId, data)
      return data
    } catch (_e) {
      return { count: 0, rowIds: [] }
    } finally {
      reactiveMapSet(dirtyCountLoading, colId, false)
    }
  }

  const debouncedFetchDirty = useDebounceFn((modelId: string, colId: string) => {
    fetchFieldAgentDirtyCount(modelId, colId)
  }, 2000)

  /** Number of dirty (stale) rows for a given field agent column. Prefers server-side data. */
  const getFieldAgentDirtyCount = (colId: string): number => {
    const serverData = serverDirtyCounts.value.get(colId)
    if (serverData !== undefined) return serverData.count
    return dirtyFieldAgentRows.value.get(colId)?.size ?? 0
  }

  /** Row PKs that need re-generation for a given field agent column. Prefers server-side data. */
  const getFieldAgentDirtyRowIds = (colId: string): string[] => {
    const serverData = serverDirtyCounts.value.get(colId)
    if (serverData !== undefined) return serverData.rowIds
    return [...(dirtyFieldAgentRows.value.get(colId) ?? [])]
  }

  /** Whether a dirty count fetch is in progress for a column. */
  const isDirtyCountLoading = (colId: string): boolean => {
    return dirtyCountLoading.value.get(colId) ?? false
  }

  /** Clear dirty state for a single field agent column (e.g. after successful generation). */
  const clearFieldAgentDirty = (colId: string) => {
    reactiveMapDelete(dirtyFieldAgentRows, colId)
    reactiveMapDelete(serverDirtyCounts, colId)
  }

  /** Reset all dirty state (e.g. on table switch). */
  const clearAllFieldAgentDirty = () => {
    dirtyFieldAgentRows.value = new Map()
    serverDirtyCounts.value = new Map()
  }

  /**
   * Dispatch a background job for bulk field agent generation.
   * Returns the job ID. Caller should subscribe via $poller.
   */
  const dispatchFieldAgentJob = async (
    modelId: string,
    params: {
      columnId: string
      mode: 'all' | 'unmodified' | 'modified'
      viewId?: string
    },
  ): Promise<{ id: string } | undefined> => {
    try {
      const res = await $api.instance.post<{ id: string }>(`/api/v2/ai/tables/${modelId}/field-agent/generate`, params)
      $e('a:field-agent:bulk:dispatch', { mode: params.mode })
      return res.data
    } catch (e: any) {
      const error = await extractSdkResponseErrorMsg(e)
      message.error(error || 'Failed to start field agent job')
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
    canvasBulkAiGeneration,
    // Field agent dirty tracking
    buildFieldAgentDependencyMap,
    onFieldAgentCellUpdate,
    getFieldAgentDirtyCount,
    getFieldAgentDirtyRowIds,
    clearFieldAgentDirty,
    clearAllFieldAgentDirty,
    // Server-side dirty tracking (persistent)
    fetchFieldAgentDirtyCount,
    isDirtyCountLoading,
    serverDirtyCounts,
    // Bulk job dispatch
    dispatchFieldAgentJob,
  }
})

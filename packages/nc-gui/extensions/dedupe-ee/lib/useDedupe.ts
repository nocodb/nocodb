import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import { ViewTypes, getFirstNonPersonalView, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { extensionUserPrefsManager } from '#imports'
import type { DedupeConfig, DuplicateSet, MergeState } from './context'
import axios from 'axios'

const [useProvideDedupe, useDedupe] = createInjectionState(() => {
  const { $api } = useNuxtApp()
  const { user } = useGlobal()
  const {
    extension,
    tables,
    getViewsForTable,
    getTableMeta,
    getData,
    updateData,
    reloadData,
    activeBaseId,
    activeTableId,
    activeViewId,
  } = useExtensionHelperOrThrow()

  // State
  const config = ref<DedupeConfig>({
    selectedTableId: undefined,
    selectedViewId: undefined,
    selectedFieldIds: [],
    selectedFieldId: undefined,
  })

  const isLoadingGroupSets = ref(false)

  const currentStep = ref<'config' | 'review'>('config')

  const views = ref<ViewType[]>([])
  const meta = ref<TableType>()
  const duplicateSets = ref<DuplicateSet[]>([])
  const currentSetIndex = ref(0)
  const isFindingDuplicates = ref(false)
  const isMerging = ref(false)
  const isLoadingMoreSets = ref(false)
  const totalDuplicateSets = ref(0)
  const hasMoreDuplicateSets = ref(false)
  const duplicateSetsPage = ref(1)
  const pageSize = 20

  const scrollContainer = ref<HTMLElement>()

  const mergeState = ref<MergeState>({
    primaryRecordId: null,
    excludedRecordIds: new Set(),
    selectedFields: {},
  })

  // Computed
  const tableList = computed(() => {
    return tables.value.map((table) => ({
      label: table.title,
      value: table.id,
      tableMeta: table,
      meta: table.meta,
      synced: table.synced,
    }))
  })

  const viewList = computed(() => {
    if (!config.value.selectedTableId) return []
    return views.value
      .filter((view) => view.type !== ViewTypes.FORM)
      .map((view) => ({
        label: view.title,
        value: view.id,
        meta: view.meta,
        type: view.type,
      }))
  })

  const selectedField = computed(() => {
    if (!config.value.selectedFieldId) return null
    return meta.value?.columns?.find((col) => col.id === config.value.selectedFieldId)
  })

  const availableFields = computed(() => {
    if (!meta.value?.columns) return []
    return meta.value.columns.filter((col) => {
      if (isSystemColumn(col) || isVirtualCol(col)) return false
      return ![UITypes.Attachment, UITypes.Links, UITypes.Rollup, UITypes.Lookup, UITypes.Formula].includes(col.uidt as UITypes)
    })
  })

  const currentDuplicateSet = computed(() => {
    if (currentSetIndex.value >= duplicateSets.value.length) return null
    return duplicateSets.value[currentSetIndex.value]
  })

  const currentSetRecords = computed(() => {
    if (!currentDuplicateSet.value || !currentDuplicateSet.value.records) return []
    return currentDuplicateSet.value.records.filter((record) => !mergeState.value.excludedRecordIds.has(record.Id))
  })

  const isLoadingCurrentSetRecords = ref(false)

  const hasMoreSets = computed(() => {
    return hasMoreDuplicateSets.value || currentSetIndex.value < duplicateSets.value.length - 1
  })

  const hasPreviousSets = computed(() => {
    return currentSetIndex.value > 0
  })

  // Methods
  const reloadViews = async () => {
    if (config.value.selectedTableId) {
      views.value = await getViewsForTable(config.value.selectedTableId)
    }
  }

  const loadTableMeta = async () => {
    if (!config.value.selectedTableId) return
    const tableMeta = await getTableMeta(config.value.selectedTableId)
    if (tableMeta) {
      meta.value = tableMeta
    }
  }

  // Reset all dedupe state
  const resetDedupeState = () => {
    // Clear field selection
    config.value.selectedFieldIds = []
    config.value.selectedFieldId = undefined
    
    // Clear group sets
    groupSets.value = []
    hasMoreGroupSets.value = false
    groupSetsPage.value = 1
    totalGroupSets.value = 0
    
    // Clear duplicate sets
    duplicateSets.value = []
    currentSetIndex.value = 0
    totalDuplicateSets.value = 0
    hasMoreDuplicateSets.value = false
    duplicateSetsPage.value = 1
    
    // Reset merge state
    mergeState.value = {
      primaryRecordId: null,
      excludedRecordIds: new Set(),
      selectedFields: {},
    }
    
    // Reset step to config
    currentStep.value = 'config'
    
    // Cancel any ongoing requests
    if (loadGroupSetsController.value) {
      loadGroupSetsController.value.cancel()
      loadGroupSetsController.value = undefined
    }
  }

  const onTableSelect = async (tableId?: string) => {
    // Reset all dedupe state when table changes
    resetDedupeState()
    
    if (!tableId) {
      config.value.selectedTableId = activeTableId.value
      await reloadViews()
      config.value.selectedViewId = activeViewId.value
    } else {
      config.value.selectedTableId = tableId
      await reloadViews()
      config.value.selectedViewId =
        getFirstNonPersonalView(views.value, {
          excludeViewType: ViewTypes.FORM,
        })?.id || activeViewId.value
    }
    await loadTableMeta()
    await saveConfig()
  }

  const onViewSelect = async (viewId: string) => {
    // Reset dedupe state when view changes (since field selection depends on view)
    resetDedupeState()
    config.value.selectedViewId = viewId
    await saveConfig()
  }

  const saveConfig = async () => {
    if (!user.value?.id) return
    extensionUserPrefsManager.set(user.value.id, extension.value.id, config.value, extension.value.baseId)
  }

  const loadSavedConfig = async () => {
    if (!user.value?.id) return
    const saved = extensionUserPrefsManager.get(user.value.id, extension.value.id)
    if (saved) {
      config.value = { ...config.value, ...saved }
    }

    if (!config.value.selectedTableId && activeTableId.value) {
      config.value.selectedTableId = activeTableId.value
    }

    await reloadViews()
    await loadTableMeta()

    if (config.value.selectedTableId && !config.value.selectedViewId) {
      config.value.selectedViewId =
        getFirstNonPersonalView(views.value, {
          excludeViewType: ViewTypes.FORM,
        })?.id || activeViewId.value
    }
  }

  // Build where query for a duplicate group
  const buildWhereQueryForGroup = (fieldValues: Record<string, any>): string => {
    const conditions: string[] = []
    for (const [fieldId, value] of Object.entries(fieldValues)) {
      const field = meta.value?.columns?.find((col) => col.id === fieldId)
      if (!field) continue

      const fieldKey = field.title || field.id
      if (!fieldKey) continue

      // Handle null/empty values
      if (value == null || value === '') {
        conditions.push(`(${fieldKey},is,blank)`)
      } else {
        // Escape value for where query
        const escapedValue = String(value).replace(/'/g, "''")
        conditions.push(`(${fieldKey},eq,${escapedValue})`)
      }
    }
    return conditions.join('~and')
  }

  // Load records for a specific duplicate group using where query
  const loadRecordsForGroup = async (duplicateSet: DuplicateSet) => {
    if (duplicateSet.records) return // Already loaded

    isLoadingCurrentSetRecords.value = true
    try {
      if (!config.value.selectedTableId || !extension.value.baseId) {
        throw new Error('Table ID or base ID is missing')
      }

      const whereQuery = buildWhereQueryForGroup(duplicateSet.fieldValues)
      const allRecords: Record<string, any>[] = []

      // Use API directly with where query to fetch only records matching this group
      let page = 1
      const pageSize = 100

      const fetchPage = async () => {
        const response = await $api.dbViewRow.list(
          'noco',
          extension.value.baseId,
          config.value.selectedTableId!,
          config.value.selectedViewId || '',
          {
            offset: (page - 1) * pageSize,
            limit: pageSize,
            where: whereQuery,
          } as any,
        )

        allRecords.push(...(response.list || []))

        if (response.pageInfo?.isLastPage) {
          duplicateSet.records = allRecords
        } else {
          page++
          await fetchPage()
        }
      }

      await fetchPage()
    } catch (error: any) {
      message.error(`Error loading records for duplicate group: ${error.message || 'Unknown error'}`)
    } finally {
      isLoadingCurrentSetRecords.value = false
    }
  }

  // Find duplicate groups (only metadata, not all records)
  const findDuplicates = async (reset = true) => {
    if (!config.value.selectedTableId || !config.value.selectedFieldIds.length) {
      message.error('Please select a table and at least one field for duplicate detection')
      return
    }

    if (reset) {
      isFindingDuplicates.value = true
      duplicateSets.value = []
      currentSetIndex.value = 0
      duplicateSetsPage.value = 1
      resetMergeState()
    } else {
      isLoadingMoreSets.value = true
    }

    try {
      // Use a Map to track groups as we process records in batches
      const groupMap = new Map<string, { fieldValues: Record<string, any>; count: number }>()
      let processedRecords = 0

      await getData({
        tableId: config.value.selectedTableId!,
        viewId: config.value.selectedViewId,
        eachPage: async (records, nextPage) => {
          // Process this batch of records
          for (const record of records) {
            processedRecords++
            const fieldValues: Record<string, any> = {}
            const keyParts: string[] = []

            for (const fieldId of config.value.selectedFieldIds) {
              const field = meta.value?.columns?.find((col) => col.id === fieldId)
              if (!field) continue

              const fieldKey = field.title || field.id
              if (!fieldKey) continue
              const value = record[fieldKey]
              const normalizedValue = value != null ? String(value).trim() : ''
              fieldValues[fieldId] = normalizedValue
              keyParts.push(`${fieldId}:${normalizedValue}`)
            }

            const key = keyParts.join('||')
            if (!groupMap.has(key)) {
              groupMap.set(key, { fieldValues, count: 0 })
            }
            groupMap.get(key)!.count++
          }

          nextPage()
        },
        done: async () => {
          // Convert groups to duplicate sets (only groups with count > 1)
          const newSets: DuplicateSet[] = []
          for (const [key, { fieldValues, count }] of groupMap.entries()) {
            if (count > 1) {
              newSets.push({
                key,
                fieldValues,
                recordCount: count,
              })
            }
          }

          if (reset) {
            duplicateSets.value = newSets.slice(0, pageSize)
            totalDuplicateSets.value = newSets.length
            hasMoreDuplicateSets.value = newSets.length > pageSize

            if (duplicateSets.value.length === 0) {
              message.info('No duplicate records found')
            } else {
              message.success(`Found ${totalDuplicateSets.value} set(s) of duplicate records`)
            }
          } else {
            // Append more sets for infinite scroll
            const startIndex = (duplicateSetsPage.value - 1) * pageSize
            const endIndex = startIndex + pageSize
            duplicateSets.value.push(...newSets.slice(startIndex, endIndex))
            hasMoreDuplicateSets.value = endIndex < newSets.length
          }
        },
      })
    } catch (error: any) {
      message.error(`Error finding duplicates: ${error.message || 'Unknown error'}`)
    } finally {
      isFindingDuplicates.value = false
      isLoadingMoreSets.value = false
    }
  }

  // Load more duplicate sets (infinite scroll)
  const loadMoreDuplicateSets = async () => {
    if (!hasMoreDuplicateSets.value || isLoadingMoreSets.value) return
    duplicateSetsPage.value++
    await findDuplicates(false)
  }

  const resetMergeState = () => {
    mergeState.value = {
      primaryRecordId: null,
      excludedRecordIds: new Set(),
      selectedFields: {},
    }
  }

  const setPrimaryRecord = (recordId: string) => {
    mergeState.value.primaryRecordId = recordId
    mergeState.value.selectedFields = {}
  }

  const excludeRecord = (recordId: string) => {
    mergeState.value.excludedRecordIds.add(recordId)
    Object.keys(mergeState.value.selectedFields).forEach((fieldId) => {
      if (mergeState.value.selectedFields[fieldId] === recordId) {
        delete mergeState.value.selectedFields[fieldId]
      }
    })
  }

  const includeRecord = (recordId: string) => {
    mergeState.value.excludedRecordIds.delete(recordId)
  }

  const selectFieldValue = (fieldId: string, recordId: string) => {
    if (!fieldId) return
    mergeState.value.selectedFields[fieldId] = recordId
  }

  const getFieldValue = (fieldId: string, recordId: string) => {
    const record = currentSetRecords.value.find((r) => r.Id === recordId)
    if (!record) return null

    const field = meta.value?.columns?.find((col) => col.id === fieldId)
    if (!field) return null

    const fieldKey = field.title || field.id
    if (!fieldKey) return null

    return record[fieldKey]
  }

  const getSelectedFieldValue = (fieldId: string) => {
    const selectedRecordId = mergeState.value.selectedFields[fieldId]
    if (!selectedRecordId) return null

    return getFieldValue(fieldId, selectedRecordId)
  }

  const nextSet = () => {
    if (hasMoreSets.value) {
      currentSetIndex.value++
      resetMergeState()
    }
  }

  const previousSet = () => {
    if (hasPreviousSets.value) {
      currentSetIndex.value--
      resetMergeState()
    }
  }

  const mergeAndDelete = async () => {
    if (!mergeState.value.primaryRecordId || !currentDuplicateSet.value) {
      message.error('Please select a primary record')
      return
    }

    const recordsToDelete = currentSetRecords.value.filter((r) => r.Id !== mergeState.value.primaryRecordId).map((r) => r.Id)

    if (recordsToDelete.length === 0) {
      message.info('No records to delete')
      return
    }

    isMerging.value = true

    try {
      const mergedData: Record<string, any> = {}
      const primaryRecord = currentSetRecords.value.find((r) => r.Id === mergeState.value.primaryRecordId)

      if (!primaryRecord) {
        throw new Error('Primary record not found')
      }

      for (const field of availableFields.value) {
        const fieldKey = field.title || field.id
        if (!fieldKey) continue
        mergedData[fieldKey] = primaryRecord[fieldKey]
      }

      for (const [fieldId, recordId] of Object.entries(mergeState.value.selectedFields)) {
        const field = meta.value?.columns?.find((col) => col.id === fieldId)
        if (!field) continue

        const fieldKey = field.title || field.id
        if (!fieldKey) continue
        const value = getFieldValue(fieldId, recordId)
        if (value != null) {
          mergedData[fieldKey] = value
        }
      }

      if (!config.value.selectedTableId || !extension.value.baseId) {
        throw new Error('Table ID or base ID is missing')
      }

      await updateData({
        tableId: config.value.selectedTableId,
        data: [
          {
            Id: mergeState.value.primaryRecordId,
            ...mergedData,
          },
        ],
      })

      for (const recordId of recordsToDelete) {
        try {
          await $api.dbViewRow.delete(
            'noco',
            extension.value.baseId,
            config.value.selectedTableId,
            config.value.selectedViewId || '',
            encodeURIComponent(recordId),
          )
        } catch (error: any) {
          console.error(`Failed to delete record ${recordId}:`, error)
        }
      }

      duplicateSets.value.splice(currentSetIndex.value, 1)

      if (currentSetIndex.value >= duplicateSets.value.length && duplicateSets.value.length > 0) {
        currentSetIndex.value = duplicateSets.value.length - 1
      }

      resetMergeState()

      if (duplicateSets.value.length === 0) {
        message.success('All duplicates have been merged and deleted')
        await reloadData()
        return true
      } else {
        message.success(`Merged and deleted ${recordsToDelete.length} record(s)`)
        return false
      }
    } catch (error: any) {
      message.error(`Error merging records: ${error.message || 'Unknown error'}`)
      return false
    } finally {
      isMerging.value = false
    }
  }

  const groupSets = ref<Record<string, any>[]>([])
  const hasMoreGroupSets = ref(false)
  const groupSetsPage = ref(1)
  const groupSetsPageSize = 50
  const totalGroupSets = ref(0)

  const loadGroupSetsController = ref() // A ref to manage the CancelToken source for Axios requests.

  async function loadGroupSets(reset = true) {
    if (!config.value.selectedTableId || !config.value.selectedViewId || !config.value.selectedFieldId) {
      return
    }

    // Cancel any ongoing request before starting a new one
    if (loadGroupSetsController.value) {
      loadGroupSetsController.value.cancel() // Cancels the previous request to prevent overlapping calls.
    }

    const CancelToken = axios.CancelToken // Axios CancelToken utility.
    loadGroupSetsController.value = CancelToken.source() // Create a new token source for the current request.

    if (reset) {
      groupSets.value = []
      groupSetsPage.value = 1
      isLoadingGroupSets.value = true
    }

    try {
      const res = await $api.dbViewRow.groupBy(
        'noco',
        activeBaseId.value!,
        config.value.selectedTableId,
        config.value.selectedViewId,
        {
          offset: (groupSetsPage.value - 1) * groupSetsPageSize,
          limit: groupSetsPageSize,
          sort: `+${selectedField.value?.title}` as any,
          column_name: selectedField.value?.title,
          minCount: 2, // Only return groups with count >= 2 (duplicates)
        } as any, // Type assertion needed until API types are updated
        loadGroupSetsController.value ? { cancelToken: loadGroupSetsController.value.token } : undefined,
      )

      if (reset) {
        groupSets.value = res.list || []
        totalGroupSets.value = res.pageInfo?.totalRows || res.list?.length || 0
      } else {
        groupSets.value.push(...(res.list || []))
      }

      hasMoreGroupSets.value = !res.pageInfo?.isLastPage && (res.list?.length || 0) >= groupSetsPageSize
    } catch (error: any) {
      if (!axios.isCancel(error)) {
        message.error(`Error loading group sets: ${error.message || 'Unknown error'}`)
      }
    } finally {
      isLoadingGroupSets.value = false
    }
  }

  async function loadMoreGroupSets() {
    if (!hasMoreGroupSets.value || isLoadingGroupSets.value) return
    groupSetsPage.value++
    await loadGroupSets(false)
  }

  return {
    // State
    config,
    views,
    meta,
    duplicateSets,
    currentSetIndex,
    isFindingDuplicates,
    isMerging,
    mergeState,
    currentStep,
    scrollContainer,

    // Computed
    tableList,
    viewList,
    availableFields,
    selectedField,
    currentDuplicateSet,
    currentSetRecords,
    hasMoreSets,
    hasPreviousSets,
    isLoadingCurrentSetRecords,
    isLoadingMoreSets,
    totalDuplicateSets,
    hasMoreDuplicateSets,

    // Methods
    reloadViews,
    loadTableMeta,
    onTableSelect,
    onViewSelect,
    saveConfig,
    loadSavedConfig,
    findDuplicates,
    loadMoreDuplicateSets,
    loadRecordsForGroup,
    resetMergeState,
    setPrimaryRecord,
    excludeRecord,
    includeRecord,
    selectFieldValue,
    getFieldValue,
    getSelectedFieldValue,
    nextSet,
    previousSet,
    mergeAndDelete,
    groupSets,
    isLoadingGroupSets,
    loadGroupSets,
    loadMoreGroupSets,
    hasMoreGroupSets,
    totalGroupSets,
  }
})

export { useProvideDedupe }

export function useDedupeOrThrow() {
  const dedupe = useDedupe()
  if (dedupe == null) {
    throw new Error('useDedupe must be used within a component that calls useProvideDedupe')
  }
  return dedupe
}

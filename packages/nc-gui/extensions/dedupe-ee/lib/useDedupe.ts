import type { ColumnType, TableType, ViewType, PaginatedType } from 'nocodb-sdk'
import { ViewTypes, getFirstNonPersonalView, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { extensionUserPrefsManager } from '#imports'
import type { DedupeConfig, DuplicateSet, MergeState } from './context'
import axios from 'axios'

const getDefaultPaginationData = (pageSize = 50): PaginatedType => {
  return { page: 1, pageSize, totalRows: 0, isFirstPage: true, isLastPage: false }
}

const getDefaultMergeState = (): MergeState => {
  return {
    primaryRecordId: null,
    excludedRecordIds: new Set(),
    selectedFields: {},
  }
}

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
  const scrollContainer = ref<HTMLElement>()

  const config = ref<DedupeConfig>({
    selectedTableId: undefined,
    selectedViewId: undefined,
    selectedFieldIds: [],
    selectedFieldId: undefined,
  })

  const currentStep = ref<'config' | 'review'>('config')

  const views = ref<ViewType[]>([])
  const meta = ref<TableType>()
  const duplicateSets = ref<DuplicateSet[]>([])
  const currentSetIndex = ref(0)
  const isMerging = ref(false)
  const isLoadingMoreSets = ref(false)
  const hasMoreDuplicateSets = ref(false)
  const duplicateSetsPage = ref(1)
  const pageSize = 20

  const groupSets = ref<Record<string, any>[]>([])

  const hasMoreGroupSets = ref(false)

  const groupSetsPaginationData = ref<PaginatedType & { isLoading: boolean }>({ ...getDefaultPaginationData(), isLoading: false })

  const loadGroupSetsController = ref() // A ref to manage the CancelToken source for Axios requests.

  const currentGroupIndex = ref(0)

  const currentGroup = computed(() => {
    return groupSets.value[currentGroupIndex.value] ?? null
  })

  const hasNextGroup = computed(() => {
    return currentGroupIndex.value < groupSets.value.length - 1
  })

  const currentGroupRecords = ref<Record<string, any>[]>([])

  const currentGroupRecordsPaginationData = ref<PaginatedType & { isLoading: boolean }>({
    ...getDefaultPaginationData(20),
    isLoading: false,
  })

  const mergeState = ref<MergeState>({ ...getDefaultMergeState() })

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

    // Clear group sets (only when resetting completely, not when navigating between groups)
    groupSets.value = []
    groupSetsPaginationData.value = { ...getDefaultPaginationData(), isLoading: false }

    // Clear duplicate sets
    duplicateSets.value = []
    currentSetIndex.value = 0
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

  // Reset merge state only (for navigating between groups)
  const resetMergeStateOnly = () => {
    mergeState.value = {
      primaryRecordId: null,
      excludedRecordIds: new Set(),
      selectedFields: {},
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
          // Update the duplicateSet in the array to ensure reactivity
          const setIndex = duplicateSets.value.findIndex((ds) => ds.key === duplicateSet.key)
          if (setIndex !== -1 && duplicateSets.value[setIndex]) {
            duplicateSets.value[setIndex] = {
              ...duplicateSets.value[setIndex],
              records: allRecords,
            }
          } else {
            duplicateSet.records = allRecords
          }
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
    if (!config.value.selectedTableId || !config.value.selectedFieldId || !selectedField.value) {
      message.error('Please select a table and field for duplicate detection')
      return
    }

    const whereQuery = buildWhereQueryForGroup({
      [selectedField.value.id!]: currentGroup.value?.[selectedField.value.title!],
    })

    if (reset) {
      currentGroupRecordsPaginationData.value = { ...getDefaultPaginationData(20), isLoading: true }

      duplicateSets.value = []
      currentSetIndex.value = 0
      duplicateSetsPage.value = 1
      resetMergeState()
    } else {
      isLoadingMoreSets.value = true
    }

    try {
      await getData({
        tableId: config.value.selectedTableId!,
        viewId: config.value.selectedViewId,
        where: whereQuery,
        eachPage: async (records, nextPage) => {
          currentGroupRecords.value.push(...records)
          nextPage()
        },
        done: async () => {},
      })
    } catch (error: any) {
      message.error(`Error finding duplicates: ${error.message || 'Unknown error'}`)
    } finally {
      currentGroupRecordsPaginationData.value.isLoading = false
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

  const nextSet = async () => {
    if (hasMoreSets.value) {
      currentSetIndex.value++
      resetMergeStateOnly()
      // Load records for the new current set if not already loaded
      const currentSet = duplicateSets.value[currentSetIndex.value]
      if (currentSet && !currentSet.records) {
        await loadRecordsForGroup(currentSet)
      }
    }
  }

  const previousSet = async () => {
    if (hasPreviousSets.value) {
      currentSetIndex.value--
      resetMergeStateOnly()
      // Load records for the new current set if not already loaded
      const currentSet = duplicateSets.value[currentSetIndex.value]
      if (currentSet && !currentSet.records) {
        await loadRecordsForGroup(currentSet)
      }
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
      groupSetsPaginationData.value = { ...getDefaultPaginationData(), isLoading: true }
      groupSets.value = []
    }

    try {
      const res = await $api.dbViewRow.groupBy(
        'noco',
        activeBaseId.value!,
        config.value.selectedTableId,
        config.value.selectedViewId,
        {
          offset: (groupSetsPaginationData.value.page! - 1) * groupSetsPaginationData.value.pageSize!,
          limit: groupSetsPaginationData.value.pageSize!,
          sort: `+${selectedField.value?.title}` as any,
          column_name: selectedField.value?.title,
          minCount: 2, // Only return groups with count >= 2 (duplicates)
        } as any, // Type assertion needed until API types are updated

        loadGroupSetsController.value ? { cancelToken: loadGroupSetsController.value.token } : undefined,
      )

      groupSetsPaginationData.value = { ...groupSetsPaginationData.value, ...res.pageInfo }

      if (reset) {
        groupSets.value = res.list || []
      } else {
        groupSets.value.push(...(res.list || []))

        groupSets.value = [...groupSets.value]
      }
    } catch (error: any) {
      if (!axios.isCancel(error)) {
        message.error(`Error loading group sets: ${error.message || 'Unknown error'}`)
      }
    } finally {
      groupSetsPaginationData.value.isLoading = false
    }
  }

  async function loadMoreGroupSets() {
    if (groupSetsPaginationData.value.isLastPage || groupSetsPaginationData.value.isLoading) return
    groupSetsPaginationData.value.page!++
    await loadGroupSets(false)
  }

  // Navigate to review step - convert all groupSets to duplicateSets
  async function navigateToReviewForGroup(group?: Record<string, any>) {
    if (!config.value.selectedFieldId || !selectedField.value) return

    const fieldTitle = selectedField.value.title
    if (!fieldTitle) return

    // Ensure we have groups loaded
    if (groupSets.value.length === 0) {
      await loadGroupSets(true)
    }

    // Convert all currently loaded groupSets to duplicateSets
    const newDuplicateSets: DuplicateSet[] = []
    for (const groupItem of groupSets.value) {
      const fieldValues: Record<string, any> = {}
      if (groupItem[fieldTitle] !== undefined) {
        fieldValues[config.value.selectedFieldId] = groupItem[fieldTitle]
      }

      const duplicateSet: DuplicateSet = {
        key: `${config.value.selectedFieldId}:${groupItem[fieldTitle] || 'null'}`,
        fieldValues,
        recordCount: groupItem.count || 0,
        records: undefined, // Will be loaded on demand
      }
      newDuplicateSets.push(duplicateSet)
    }

    // Set all duplicate sets
    duplicateSets.value = newDuplicateSets

    hasMoreDuplicateSets.value = hasMoreGroupSets.value

    // Find the index of the selected group, or default to 0
    let initialIndex = 0
    if (group && fieldTitle && config.value.selectedFieldId) {
      const selectedValue = group[fieldTitle]
      const selectedFieldId = config.value.selectedFieldId
      initialIndex = newDuplicateSets.findIndex((ds) => ds.fieldValues[selectedFieldId] === selectedValue)
      if (initialIndex === -1) initialIndex = 0
    }

    currentSetIndex.value = initialIndex

    // Reset merge state only (don't clear groupSets)
    resetMergeStateOnly()

    // Navigate to review step
    currentStep.value = 'review'

    // Load records for the initial group
    const initialDuplicateSet = duplicateSets.value[currentSetIndex.value]
    if (initialDuplicateSet) {
      await loadRecordsForGroup(initialDuplicateSet)
    }
  }

  return {
    // State
    config,
    views,
    meta,
    duplicateSets,
    currentSetIndex,
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
    hasMoreDuplicateSets,
    groupSetsPaginationData,
    currentGroup,
    hasNextGroup,
    currentGroupRecords,

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
    resetMergeStateOnly,
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
    loadGroupSets,
    loadMoreGroupSets,
    navigateToReviewForGroup,
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

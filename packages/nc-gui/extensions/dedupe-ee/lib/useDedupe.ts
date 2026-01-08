import type { ColumnType, PaginatedType, TableType, ViewType } from 'nocodb-sdk'
import {
  UITypes,
  ViewTypes,
  getFirstNonPersonalView,
  isSystemColumn,
  isVirtualCol,
  parseUserValue,
  parseJsonValue,
  isDateOrDateTimeCol,
  parseCheckboxValue,
} from 'nocodb-sdk'
import axios from 'axios'
import type { DedupeConfig, MergeState } from './context'
import { extensionUserPrefsManager } from '#imports'

import type { Row } from '#imports'

const getDefaultPaginationData = (pageSize = 50): PaginatedType => {
  return { page: 1, pageSize, totalRows: 0, isFirstPage: true, isLastPage: false }
}

const getDefaultMergeState = (): MergeState => {
  return {
    primaryRecordId: null,
    primaryRecordIndex: null,
    excludedRecordIndexes: new Set(),
    excludedRecordIds: new Set(),
    selectedFields: {},
  }
}

const [useProvideDedupe, useDedupe] = createInjectionState(() => {
  const { $api } = useNuxtApp()
  const { user } = useGlobal()
  const { extension, tables, getViewsForTable, getTableMeta, updateData, reloadData, activeBaseId, activeTableId, activeViewId } =
    useExtensionHelperOrThrow()

  const { clone } = useUndoRedo()

  // State
  const scrollContainer = ref<HTMLElement>()
  const scrollTop = ref(0)

  const config = ref<DedupeConfig>({
    selectedTableId: undefined,
    selectedViewId: undefined,
    selectedFieldIds: [],
    selectedFieldId: undefined,
  })

  const currentStep = ref<'config' | 'review'>('config')

  const views = ref<ViewType[]>([])
  const meta = ref<TableType>()
  const isMerging = ref(false)

  const groupSets = ref<Record<string, any>[]>([])

  const groupSetsPaginationData = ref<PaginatedType & { isLoading: boolean }>({ ...getDefaultPaginationData(), isLoading: false })

  const loadGroupSetsController = ref() // A ref to manage the CancelToken source for Axios requests.

  const currentGroupIndex = ref(0)

  const currentGroup = computed(() => {
    return groupSets.value[currentGroupIndex.value] ?? null
  })

  const hasNextGroup = computed(() => {
    return currentGroupIndex.value < (groupSetsPaginationData.value.totalRows || 0) - 1
  })

  const currentGroupRecordsPaginationData = ref<PaginatedType & { isLoading: boolean }>({
    ...getDefaultPaginationData(20),
    isLoading: false,
  })

  const mergeState = ref<MergeState>({ ...getDefaultMergeState() })

  const contextMenuTarget = ref<{ row: Row; index: number } | null>(null)

  const saveConfig = async () => {
    if (!user.value?.id) return
    extensionUserPrefsManager.set(user.value.id, extension.value.id, config.value, extension.value.baseId)
  }

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

  const selectedView = computed(() => {
    if (!config.value.selectedViewId) return null
    return views.value.find((view) => view.id === config.value.selectedViewId)
  })

  // fields to render
  const fields = computed(() => {
    return (meta.value?.columns || [])
      .filter((col) => {
        if (isSystemColumn(col) || col.id === selectedField.value?.id) return false
        return true
      })
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  })

  const availableFields = computed(() => {
    if (!meta.value?.columns) return []
    return meta.value.columns
      .filter((col) => {
        if (isSystemColumn(col) || isVirtualCol(col)) return false
        return ![UITypes.Attachment, UITypes.Links, UITypes.Rollup, UITypes.Lookup, UITypes.Formula].includes(col.uidt as UITypes)
      })
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  })

  const computedWhere = computed(() => {
    if (!selectedField.value?.id || !currentGroup.value) return ''

    let value = currentGroup.value[selectedField.value.title!]

    if (selectedField.value.uidt === UITypes.User) {
      value = parseUserValue(value, false, true)

      if (ncIsString(value)) {
        value = value
          .split(',')
          .map((id: string) => id.trim())
          .join(',')
      }
    } else if (selectedField.value.uidt === UITypes.JSON) {
      value = parseJsonValue(value)
    } else if (selectedField.value.uidt === UITypes.Checkbox) {
      value = parseCheckboxValue(value)
    }

    return buildWhereQueryForGroup({
      [selectedField.value.id!]: value,
    })
  })

  const { cachedRows, loadData, syncCount, totalRows, chunkStates, clearCache } = useInfiniteData({
    meta,
    viewMeta: selectedView,
    where: computedWhere,
    callbacks: {
      getWhereFilter: async (_path, ignoreWhereFilter) => (ignoreWhereFilter ? '' : computedWhere.value),
    },
    disableSmartsheet: true,
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

    // Reset merge state
    resetMergeState()

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
  function buildWhereQueryForGroup(fieldValues: Record<string, any>): string {
    const conditions: string[] = []
    for (let [fieldId, value] of Object.entries(fieldValues)) {
      const field = meta.value?.columns?.find((col) => col.id === fieldId)
      if (!field) continue

      const fieldKey = field.title || field.id
      if (!fieldKey) continue

      let operator = 'eq'

      if (field.uidt === UITypes.MultiSelect || field.uidt === UITypes.User) {
        operator = 'allof'
      }

      if (field.uidt === UITypes.Checkbox) {
        operator = value === true ? 'checked' : value === false ? 'notchecked' : 'eq'
      }

      // Handle null/empty values
      if (ncIsNull(value) || ncIsUndefined(value) || value === '') {
        conditions.push(`(${fieldKey},is,blank)`)
      } else if (isDateOrDateTimeCol(field)) {
        conditions.push(`(${fieldKey},eq,exactDate,${value})`)
      } else {
        // Escape value for where query
        const escapedValue = String(value).replace(/'/g, "''")
        conditions.push(`(${fieldKey},${operator},${field.uidt === UITypes.Checkbox ? null : escapedValue})`)
      }
    }
    return conditions.join('~and')
  }

  // Find duplicate groups (only metadata, not all records)
  const findDuplicates = async (reset = true) => {
    if (!config.value.selectedTableId || !config.value.selectedFieldId || !selectedField.value) {
      message.error('Please select a table and field for duplicate detection')
      return
    }

    if (reset) {
      currentGroupRecordsPaginationData.value = { ...getDefaultPaginationData(20), isLoading: true }
      resetMergeState()
    }

    try {
      if (currentGroupRecordsPaginationData.value.page === 1) {
        await syncCount()
      }

      const records = await loadData({
        limit: currentGroupRecordsPaginationData.value.pageSize!,
        offset: (currentGroupRecordsPaginationData.value.page! - 1) * currentGroupRecordsPaginationData.value.pageSize!,
      })

      records.forEach((record) => {
        cachedRows.value.set(record.rowMeta.rowIndex!, record)
      })
    } catch (error: any) {
      message.error(`Error finding duplicates: ${error.message || 'Unknown error'}`)
    } finally {
      currentGroupRecordsPaginationData.value.isLoading = false
    }
  }

  function resetMergeState() {
    mergeState.value = {
      ...getDefaultMergeState(),
    }
  }

  const setPrimaryRecord = (recordIndex: number) => {
    mergeState.value.primaryRecordIndex = recordIndex
    mergeState.value.selectedFields = {}
  }

  const excludeRecord = (recordIndex: number) => {
    Object.keys(mergeState.value.selectedFields).forEach((fieldId) => {
      if (mergeState.value.selectedFields[fieldId] === recordIndex) {
        delete mergeState.value.selectedFields[fieldId]
      }
    })

    mergeState.value.excludedRecordIndexes.add(recordIndex)

    mergeState.value = { ...mergeState.value }
  }

  const includeRecord = (recordIndex: number) => {
    mergeState.value.excludedRecordIndexes.delete(recordIndex)
  }

  const selectFieldValue = (fieldId: string, recordIndex: number) => {
    if (!fieldId) return
    mergeState.value.selectedFields[fieldId] = recordIndex
  }

  const getFieldValue = (fieldId: string, recordIndex: number) => {
    const record = cachedRows.value.get(recordIndex) ? clone(cachedRows.value.get(recordIndex)!) : null
    if (!record) return null

    const field = meta.value?.columns?.find((col) => col.id === fieldId)
    if (!field) return null

    const fieldKey = field.title || field.id
    if (!fieldKey) return null

    return record.row[fieldKey]
  }

  const primaryRecordRowInfo = computed(() => {
    const row: Row = {
      row: {},
      oldRow: {},
      rowMeta: {},
    }

    if (!ncIsNumber(mergeState.value.primaryRecordIndex)) return row

    const primaryRecord = clone(cachedRows.value.get(mergeState.value.primaryRecordIndex!))

    row.row = primaryRecord?.row ?? {}
    row.oldRow = primaryRecord?.oldRow ?? {}
    row.rowMeta = primaryRecord?.rowMeta ?? {}

    for (const [fieldId, otherFieldIndex] of Object.entries(mergeState.value.selectedFields)) {
      const field = (fields.value || []).find((col) => col.id === fieldId)

      if (!field || mergeState.value.excludedRecordIndexes.has(otherFieldIndex)) continue

      row.row[field.title || field.id!] = getFieldValue(fieldId, otherFieldIndex)
    }

    return row
  })

  const getSelectedFieldValue = (fieldId: string) => {
    const selectedRecordIndex = mergeState.value.selectedFields[fieldId]
    if (!selectedRecordIndex) return null

    return getFieldValue(fieldId, selectedRecordIndex)
  }

  const nextSet = async () => {
    if (hasNextGroup.value) {
      currentGroupRecordsPaginationData.value = { ...getDefaultPaginationData(20), isLoading: true }
      resetMergeState()

      currentGroupIndex.value++

      // If next set of groups not loaded then load it
      if (!groupSetsPaginationData.value.isLastPage && groupSetsPaginationData.value.totalRows) {
        const hasNextBufferIndex = Math.min(
          currentGroupIndex.value + 4,
          groupSetsPaginationData.value.totalRows ? groupSetsPaginationData.value.totalRows - 1 : 0,
        )

        if (!groupSets.value[hasNextBufferIndex]) {
          loadMoreGroupSets()
        }
      }
    } else {
      message.info('No more sets to review')
      currentGroupIndex.value = 0
      currentStep.value = 'config'
    }
  }

  const hasMergedAnyRecords = ref(false)

  const deleteRecordsAfterMerge = async (recordIndices: number[]) => {
    const CHUNK_SIZE = 50
    const PROCESSING_BATCH_SIZE = 1000 // Process records in chunks to reduce memory usage

    const processedPkValues = new Set<string>()

    // Process records in smaller batches to reduce memory footprint
    for (let batchStart = 0; batchStart < recordIndices.length; batchStart += PROCESSING_BATCH_SIZE) {
      const batchIndices = recordIndices.slice(batchStart, batchStart + PROCESSING_BATCH_SIZE)

      // Separate already loaded records from records that need loading for this batch
      const alreadyLoadedIndices: number[] = []
      const chunksToLoad = new Set<number>()

      batchIndices.forEach((index) => {
        // Check if record is already in cache OR if chunk is marked as loaded
        if (cachedRows.value.has(index) || chunkStates.value[Math.floor(index / CHUNK_SIZE)] === 'loaded') {
          alreadyLoadedIndices.push(index)
        } else {
          chunksToLoad.add(Math.floor(index / CHUNK_SIZE))
        }
      })

      // Collect PK data for this batch only
      const batchRecordsToDelete: Array<Record<string, any>> = []

      // First, collect PK data from already cached records
      alreadyLoadedIndices.forEach((index) => {
        const row = cachedRows.value.get(index)
        if (row) {
          processedPkValues.add(extractPkFromRow(row.row, (meta.value?.columns as ColumnType[]) || []) ?? '')
          batchRecordsToDelete.push(rowPkData(row.row, (meta.value?.columns as ColumnType[]) || []))
        }
      })

      // Then load missing chunks and extract PK data directly (without caching)
      if (chunksToLoad.size > 0) {
        await Promise.all(
          Array.from(chunksToLoad).map(async (chunkIndex) => {
            try {
              const loadedRecords = await loadData({
                limit: CHUNK_SIZE,
                offset: chunkIndex * CHUNK_SIZE,
              })

              // Extract PK data directly from loaded records for this batch
              loadedRecords.forEach((record) => {
                const rowIndex = record.rowMeta.rowIndex!
                // Only add PK data for records that are in our current batch
                if (batchIndices.includes(rowIndex)) {
                  const pkValue = extractPkFromRow(record.row, (meta.value?.columns as ColumnType[]) || []) ?? ''
                  if (!processedPkValues.has(pkValue)) {
                    processedPkValues.add(pkValue)
                    batchRecordsToDelete.push(rowPkData(record.row, (meta.value?.columns as ColumnType[]) || []))
                  }
                }
              })

              // Update chunk state to prevent future unnecessary loads
              chunkStates.value[chunkIndex] = 'loaded'
            } catch (error) {
              console.error(`Error loading chunk ${chunkIndex}:`, error)
              chunkStates.value[chunkIndex] = undefined
            }
          }),
        )
      }

      // Delete this batch immediately
      const DELETE_BATCH_SIZE = 500

      for (let i = 0; i < batchRecordsToDelete.length; i += DELETE_BATCH_SIZE) {
        const deleteBatch = batchRecordsToDelete.slice(i, i + DELETE_BATCH_SIZE)

        try {
          await $api.internal.postOperation(
            (meta.value as any).fk_workspace_id!,
            meta.value!.base_id!,
            {
              operation: 'dataDelete',
              tableId: meta.value?.id as string,
              viewId: config.value.selectedViewId || '',
            },
            deleteBatch.length === 1 ? deleteBatch[0]! : deleteBatch,
          )
        } catch (error: any) {
          console.error(
            `Error deleting batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1} in processing batch ${
              Math.floor(batchStart / PROCESSING_BATCH_SIZE) + 1
            }:`,
            error,
          )
          // Continue with next batch even if this one fails
        }

        // Small delay between delete batches
        if (i + DELETE_BATCH_SIZE < batchRecordsToDelete.length) {
          await ncDelay(50)
        }
      }

      // Small delay between processing batches to avoid overwhelming the system
      if (batchStart + PROCESSING_BATCH_SIZE < recordIndices.length) {
        await ncDelay(100)
      }
    }
  }

  const mergeAndDelete = async () => {
    if (!ncIsNumber(mergeState.value.primaryRecordIndex) || !primaryRecordRowInfo.value.row) {
      message.error('Please select a primary record')
      return
    }

    // Collect indices of records to delete instead of loading all records upfront
    const recordIndicesToDelete = Array.from({ length: totalRows.value }, (_, i) => {
      if (mergeState.value.primaryRecordIndex === i) return null
      // If record is excluded, don't delete it
      if (mergeState.value.excludedRecordIndexes.has(i)) return null
      return i
    }).filter((i): i is number => i !== null)

    if (recordIndicesToDelete.length === 0) {
      message.info('No records to delete')
      return
    }

    isMerging.value = true

    try {
      const mergedData: Record<string, any> = {}

      const primaryRecord = cachedRows.value.get(mergeState.value.primaryRecordIndex!)

      for (const field of fields.value) {
        if (isVirtualCol(field)) continue

        const fieldKey = field.title || field.id
        if (!fieldKey) continue

        mergedData[fieldKey] = primaryRecordRowInfo.value.row[fieldKey]
      }

      await updateData({
        tableId: config.value.selectedTableId!,
        data: [
          {
            ...mergedData,
            ...rowPkData(primaryRecord?.row ?? {}, meta.value?.columns as ColumnType[]),
          },
        ],
      })

      await deleteRecordsAfterMerge(recordIndicesToDelete)

      if (hasNextGroup.value) {
        currentGroupRecordsPaginationData.value = { ...getDefaultPaginationData(20), isLoading: true }
      }

      resetMergeState()

      if (!hasNextGroup.value) {
        message.success('All duplicates have been merged and deleted')
        return true
      } else {
        currentGroupIndex.value++

        message.success(`Merged and deleted ${recordIndicesToDelete.length} record(s)`)

        return false
      }
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)

      message.error(`Error merging records`, undefined, {
        copyText: errorMessage,
      })
      return false
    } finally {
      isMerging.value = false
      hasMergedAnyRecords.value = true
      reloadData()
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

  return {
    // State
    config,
    views,
    meta,

    isMerging,
    mergeState,
    currentStep,
    scrollContainer,
    scrollTop,

    // Computed
    tableList,
    viewList,
    availableFields,
    selectedField,
    groupSetsPaginationData,
    currentGroupIndex,
    currentGroup,
    hasNextGroup,
    currentGroupRecordsPaginationData,
    hasMergedAnyRecords,
    // Methods
    reloadViews,
    loadTableMeta,
    onTableSelect,
    onViewSelect,
    saveConfig,
    loadSavedConfig,
    findDuplicates,
    resetMergeState,
    setPrimaryRecord,
    excludeRecord,
    includeRecord,
    selectFieldValue,
    getFieldValue,
    getSelectedFieldValue,
    nextSet,

    mergeAndDelete,
    groupSets,
    loadGroupSets,
    loadMoreGroupSets,

    // record loading
    loadData,
    syncCount,
    cachedRows,
    totalRows,
    chunkStates,
    clearCache,
    contextMenuTarget,
    fields,
    primaryRecordRowInfo,
    syncScrollTop: (newScrollTop: number) => {
      scrollTop.value = newScrollTop
    },
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

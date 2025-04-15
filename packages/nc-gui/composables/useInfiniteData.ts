import path from 'path'
import type { ComputedRef, Ref } from 'vue'
import { NcApiVersion, UITypes, extractFilterFromXwhere, isAIPromptCol } from 'nocodb-sdk'
import {
  type Api,
  type ColumnType,
  type LinkToAnotherRecordType,
  type PaginatedType,
  type RelationTypes,
  type TableType,
  type ViewType,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isSystemColumn,
} from 'nocodb-sdk'
import type { CanvasGroup } from '../lib/types'
import type { Row } from '#imports'
import { validateRowFilters } from '~/utils/dataUtils'
import { NavigateDir } from '~/lib/enums'

const formatData = (
  list: Record<string, any>[],
  pageInfo?: PaginatedType,
  params?: {
    limit?: number
    offset?: number
  },
  path: Array<number>,
) => {
  // If pageInfo exists, use it for calculation
  if (pageInfo?.page && pageInfo?.pageSize) {
    return list.map((row, index) => {
      const rowIndex = (pageInfo.page! - 1) * pageInfo.pageSize! + index
      return {
        row: { ...row },
        oldRow: { ...row },
        rowMeta: {
          rowIndex,
          isLastRow: rowIndex === pageInfo.totalRows! - 1,
          path: path ?? [],
        },
      }
    })
  }

  // If no pageInfo, fall back to params
  const offset = params?.offset ?? 0
  return list.map((row, index) => ({
    row: { ...row },
    oldRow: { ...row },
    rowMeta: {
      rowIndex: offset + index,
    },
  }))
}

export function useInfiniteData(args: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>
  callbacks: {
    syncVisibleData?: () => void
    getCount?: (path: Array<number>) => void
    getWhereFilter?: (path: Array<number>) => string
    reloadAggregate?: (params: {
      fields?: Array<{ title: string; aggregation?: string | undefined }>
      path: Array<number>
    }) => void
    findGroupByPath?: (path?: Array<number>) => CanvasGroup | undefined
  }
  where?: ComputedRef<string | undefined>
  disableSmartsheet?: boolean
  isPublic?: Ref<boolean>
  groupByColumns?: ComputedRef<{ column: ColumnType; sort: string; order?: number }[]>
}) {
  const NOCO = 'noco'
  const { meta, viewMeta, callbacks, where, disableSmartsheet, isPublic, groupByColumns = ref(null) } = args

  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const router = useRouter()

  const { isUIAllowed } = useRoles()

  const { addUndo, clone, defineViewScope } = useUndoRedo()

  const tablesStore = useTablesStore()

  const baseStore = useBase()

  const { base } = storeToRefs(baseStore)

  const { getBaseType } = baseStore

  const { getMeta, metas } = useMetas()

  const { fetchSharedViewData, fetchCount } = useSharedView()

  const { nestedFilters, allFilters, sorts } = disableSmartsheet
    ? {
        nestedFilters: ref([]),
        allFilters: ref([]),
        sorts: ref([]),
      }
    : useSmartsheetStoreOrThrow()

  const selectedAllRecords = ref(false)

  const totalRows = ref(0)

  const cachedRows = ref<Map<number, Row>>(new Map())

  const chunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])

  const groupDataCache = shallowRef(
    new Map<
      string,
      {
        cachedRows: Ref<Map<number, Row>>
        chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
        totalRows: Ref<number>
        selectedRows: ComputedRef<Array<Row>>
        isRowSortRequiredRows: ComputedRef<Array<Row>>
      }
    >(),
  )

  const routeQuery = computed(() => router.currentRoute.value.query as Record<string, string>)

  const columnsByAlias = computed(() => {
    if (!meta.value?.columns?.length) return {}
    return meta.value?.columns.reduce((acc, column) => {
      acc[column.title!] = column
      return acc
    }, {} as Record<string, ColumnType>)
  })
  const columnsById = computed(() => {
    if (!meta.value?.columns?.length) return {}
    return meta.value?.columns.reduce((acc, column) => {
      acc[column.id!] = column
      return acc
    }, {} as Record<string, ColumnType>)
  })

  const computedWhereFilter = computed(() => {
    const { filters: filter } = extractFilterFromXwhere(
      { api_version: NcApiVersion.V1 },
      where?.value ?? '',
      columnsByAlias.value,
    )

    if (!filter?.length) return []

    return filter?.map((f) => {
      return { ...f, value: f.value ? f.value?.toString().replace(/(^%)(.*?)(%$)/, '$2') : f.value }
    })
  })

  const selectedRows = computed<Row[]>(() => {
    return Array.from(cachedRows.value.values()).filter((row) => row.rowMeta?.selected)
  })

  const isRowSortRequiredRows = computed(() => {
    return Array.from(cachedRows.value.values()).filter((row) => row.rowMeta?.isRowOrderUpdated)
  })

  const getDataCache = (path: Array<number> = []) => {
    if (path.length === 0) {
      return {
        cachedRows,
        chunkStates,
        totalRows,
        isRowSortRequiredRows,
        selectedRows,
      }
    }

    const key = path.join('-')
    const cachedData = groupDataCache.value.get(key)

    if (cachedData) {
      return cachedData
    }

    const currCount = callbacks?.getCount?.(path)

    const newCache = {
      cachedRows: ref<Map<number, Row>>(new Map<number, Row>()),
      chunkStates: ref<Array<'loading' | 'loaded' | undefined>>([]),
      totalRows: computed({
        get: () => {
          const group = callbacks?.findGroupByPath?.(path)
          if (group) {
            return group.count
          }
          return 0
        },
        set: (value) => {
          const group = callbacks?.findGroupByPath?.(path)
          if (group) {
            group.count = value
          }
        },
      }),
      selectedRows: computed<Row[]>(() => Array.from(newCache.cachedRows.value.values()).filter((row) => row.rowMeta?.selected)),
      isRowSortRequiredRows: computed<Array<Row>>(() =>
        Array.from(newCache.cachedRows.value.values()).filter((row) => row.rowMeta?.isRowOrderUpdated),
      ),
    }

    if (currCount === null) {
      syncCount(path)
    }
    groupDataCache.value.set(key, newCache)
    return newCache
  }

  const MAX_CACHE_SIZE = 200

  const CHUNK_SIZE = 50

  const getChunkIndex = (rowIndex: number) => Math.floor(rowIndex / CHUNK_SIZE)

  const fetchChunk = async (chunkId: number, path: Array<number> = [], forceFetch = false) => {
    const dataCache = getDataCache(path)

    if (dataCache.chunkStates.value[chunkId] && !forceFetch) return

    dataCache.chunkStates.value[chunkId] = 'loading'
    const offset = chunkId * CHUNK_SIZE

    try {
      const newItems = await loadData({ offset, limit: CHUNK_SIZE }, false, path)
      if (!newItems) {
        dataCache.chunkStates.value[chunkId] = undefined
        return
      }
      newItems.forEach((item) => {
        dataCache.cachedRows.value.set(item.rowMeta.rowIndex!, item)
      })
      dataCache.chunkStates.value[chunkId] = 'loaded'
    } catch (error) {
      console.error('Error fetching chunk:', error)
      dataCache.chunkStates.value[chunkId] = undefined
    }
  }

  const clearCache = (visibleStartIndex: number, visibleEndIndex: number, path: Array<number> = []) => {
    const dataCache = getDataCache(path)
    if (visibleEndIndex === Number.POSITIVE_INFINITY && visibleStartIndex === Number.NEGATIVE_INFINITY) {
      dataCache.cachedRows.value.clear()
      dataCache.chunkStates.value = []
      return
    }

    if (dataCache.cachedRows.value.size <= MAX_CACHE_SIZE) return

    const safeStartIndex = Math.max(0, visibleStartIndex)
    const safeEndIndex = Math.min(dataCache.totalRows.value - 1, visibleEndIndex)
    const safeStartChunk = getChunkIndex(safeStartIndex)
    const safeEndChunk = getChunkIndex(safeEndIndex)

    const importantChunks = new Set<number>()
    let maxChunk = 0
    for (const index of dataCache.cachedRows.value.keys()) {
      const chunkIndex = getChunkIndex(index)
      maxChunk = Math.max(maxChunk, chunkIndex)
      const row = dataCache.cachedRows.value.get(index)
      if (row && (row.rowMeta?.selected || row.rowMeta?.new || row.rowMeta?.isDragging)) {
        importantChunks.add(chunkIndex)
      }
    }

    const newCachedRows = new Map<number, Row>()
    for (let chunk = 0; chunk <= maxChunk; chunk++) {
      const isVisibleChunk = chunk >= safeStartChunk && chunk <= safeEndChunk
      if (isVisibleChunk || importantChunks.has(chunk)) {
        const chunkStart = chunk * CHUNK_SIZE
        const chunkEnd = chunkStart + CHUNK_SIZE
        for (let i = chunkStart; i < chunkEnd; i++) {
          const row = dataCache.cachedRows.value.get(i)
          if (row) newCachedRows.set(i, row)
        }
      }
    }

    dataCache.cachedRows.value = newCachedRows
    dataCache.chunkStates.value = dataCache.chunkStates.value.map((state, chunkIndex) =>
      (chunkIndex >= safeStartChunk && chunkIndex <= safeEndChunk) || importantChunks.has(chunkIndex) ? state : undefined,
    )
  }

  async function loadAggCommentsCount(formattedData: Array<Row>, path: Array<number> = []) {
    if (!isUIAllowed('commentCount') || isPublic?.value) return

    const ids = formattedData
      .filter(({ rowMeta: { new: isNew } }) => !isNew)
      .map(({ row }) => extractPkFromRow(row, meta?.value?.columns as ColumnType[]))
      .filter(Boolean)

    if (!ids.length) return

    const dataCache = getDataCache(path)

    try {
      const aggCommentCount = await $api.utils.commentCount({
        ids,
        fk_model_id: meta.value!.id as string,
      })

      formattedData.forEach((row) => {
        const cachedRow = Array.from(dataCache.cachedRows.value.values()).find(
          (cachedRow) => cachedRow.rowMeta.rowIndex === row.rowMeta.rowIndex,
        )
        if (!cachedRow) return

        const id = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
        const count = aggCommentCount?.find((c: Record<string, any>) => c.row_id === id)?.count || 0
        cachedRow.rowMeta.commentCount = +count
      })
    } catch (e) {
      console.error('Failed to load aggregate comment count:', e)
    }
  }

  async function loadData(
    params: Parameters<Api<any>['dbViewRow']['list']>[4] & {
      limit?: number
      offset?: number
      where?: string
    } = {},
    _shouldShowLoading?: boolean,
    path?: Array<number> = [],
  ): Promise<Row[]> {
    if ((!base?.value?.id || !meta.value?.id || !viewMeta.value?.id) && !isPublic?.value) return []

    const whereFilter = callbacks?.getWhereFilter?.(path)

    try {
      const response = !isPublic?.value
        ? await $api.dbViewRow.list('noco', base.value.id!, meta.value!.id!, viewMeta.value!.id!, {
            ...params,
            ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            includeSortAndFilterColumns: true,
            where: whereFilter,
          } as any)
        : await fetchSharedViewData(
            {
              sortsArr: sorts.value,
              filtersArr: nestedFilters.value,
              where: whereFilter,
              offset: params.offset,
              limit: params.limit,
            },
            {
              isInfiniteScroll: true,
            },
          )

      const data = formatData(response.list, response.pageInfo, params, path)

      loadAggCommentsCount(data, path)

      return data
    } catch (error: any) {
      if (error?.response?.data.error === 'INVALID_OFFSET_VALUE') {
        return []
      }
      if (error?.response?.data?.error === 'FORMULA_ERROR') {
        await tablesStore.reloadTableMeta(meta.value!.id! as string)
        return loadData(params)
      }

      console.error(error)
      message.error(await extractSdkResponseErrorMsg(error))
      return []
    }
  }

  const updateRecordOrder = async (
    draggedIndex: number,
    targetIndex: number | null,
    undo = false,
    isFailed = false,
    path = [],
  ) => {
    const dataCache = getDataCache(path)

    const originalRecord = dataCache.cachedRows.value.get(draggedIndex)
    if (!originalRecord) return

    const recordPk = extractPkFromRow(originalRecord.row, meta.value?.columns as ColumnType[])
    const newCachedRows = new Map(dataCache.cachedRows.value.entries())

    const beforeDraggedRecord = dataCache.cachedRows.value.get(draggedIndex + 1)
    const beforeDraggedPk = beforeDraggedRecord
      ? extractPkFromRow(beforeDraggedRecord.row, meta.value?.columns as ColumnType[])
      : null

    let targetRecord: Row | null = null
    let targetRecordPk: string | null = null
    let finalTargetIndex: number | null

    if (targetIndex === null) {
      finalTargetIndex = dataCache.cachedRows.value.size - 1
    } else {
      finalTargetIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex
      targetRecord = dataCache.cachedRows.value.get(targetIndex) ?? null
      if (!targetRecord) return
      targetRecordPk = extractPkFromRow(targetRecord.row, meta.value?.columns as ColumnType[]) || null
    }

    if (finalTargetIndex < draggedIndex) {
      for (let i = draggedIndex - 1; i >= finalTargetIndex; i--) {
        const row = newCachedRows.get(i)
        if (row) {
          const newIndex = i + 1
          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
        }
      }
    } else {
      for (let i = draggedIndex + 1; i <= finalTargetIndex; i++) {
        const row = newCachedRows.get(i)
        if (row) {
          const newIndex = i - 1
          row.rowMeta.rowIndex = newIndex
          newCachedRows.set(newIndex, row)
        }
      }
    }
    originalRecord.rowMeta.rowIndex = finalTargetIndex
    newCachedRows.set(finalTargetIndex, originalRecord)

    const indices = new Set<number>()

    for (const [_, row] of newCachedRows) {
      if (indices.has(row.rowMeta.rowIndex)) {
        console.error('Duplicate index detected:', _, row.rowMeta.rowIndex)
        break
      }
      indices.add(row.rowMeta.rowIndex)
    }

    const targetChunkIndex = getChunkIndex(finalTargetIndex)
    const sourceChunkIndex = getChunkIndex(draggedIndex)
    // TODO: Fix if issue aries with missing records. Chances are low
    // @DarkPhoenix2704
    /* for (let i = Math.min(sourceChunkIndex, targetChunkIndex); i <= Math.max(sourceChunkIndex, targetChunkIndex); i++) {
      chunkStates.value[i] = undefined
    }

    for (let i = Math.min(sourceChunkIndex, targetChunkIndex); i <= Math.max(sourceChunkIndex, targetChunkIndex); i++) {
      chunkStates.value[i] = undefined
    }
*/
    if (!isFailed) {
      $api.dbDataTableRow
        .move(meta.value!.id!, recordPk, {
          before: targetIndex === null ? null : targetRecordPk,
        })
        .then(() => {
          callbacks?.syncVisibleData?.()
        })
        .catch((e) => {
          callbacks?.syncVisibleData?.()
          message.error(`Failed to update record order: ${e}`)
        })
    }

    if (!undo) {
      addUndo({
        undo: {
          fn: async (beforePk: string | null, recPk: string, _targetCkIdx: number, _sourceChkIdx: number) => {
            await $api.dbDataTableRow.move(meta.value!.id!, recPk, {
              before: beforePk,
            })

            /* for (let i = Math.min(sourceChkIdx, targetCkIdx); i <= Math.max(sourceChkIdx, targetCkIdx); i++) {
              chunkStates.value[i] = undefined
            } */

            await callbacks?.syncVisibleData?.()
          },
          args: [beforeDraggedPk, recordPk, targetChunkIndex, sourceChunkIndex],
        },
        redo: {
          fn: async (beforePk: string | null, recPk: string, _targetCkIdx: number, _sourceChkIdx: number) => {
            await $api.dbDataTableRow.move(meta.value!.id!, recPk, {
              before: beforePk,
            })
            /*

            for (let i = Math.min(sourceChkIdx, targetCkIdx); i <= Math.max(sourceChkIdx, targetCkIdx); i++) {
              chunkStates.value[i] = undefined
            }
*/

            await callbacks?.syncVisibleData?.()
          },
          args: [targetIndex === null ? null : targetRecordPk, recordPk, targetChunkIndex, sourceChunkIndex],
        },
        scope: defineViewScope({ view: viewMeta.value }),
      })
    }

    dataCache.cachedRows.value = newCachedRows
  }

  const navigateToSiblingRow = async (dir: NavigateDir) => {
    const path = routeQuery.value?.path?.length === 0 ? [] : (routeQuery.value?.path?.split('-') ?? []).map((c) => +c)
    const expandedRowIndex = await getExpandedRowIndexWithWait(path)
    if (expandedRowIndex === -1) return

    const dataCache = getDataCache(path)

    const sortedIndices = Array.from(dataCache.cachedRows.value.keys()).sort((a, b) => a - b)
    let siblingIndex = sortedIndices.findIndex((index) => index === expandedRowIndex) + (dir === NavigateDir.NEXT ? 1 : -1)

    // Skip unsaved rows
    while (
      siblingIndex >= 0 &&
      siblingIndex < sortedIndices.length &&
      dataCache.cachedRows.value.get(sortedIndices[siblingIndex])?.rowMeta?.new
    ) {
      siblingIndex += dir === NavigateDir.NEXT ? 1 : -1
    }

    // Check if we've gone out of bounds
    if (siblingIndex < 0 || siblingIndex >= dataCache.totalRows.value) {
      return message.info(t('msg.info.noMoreRecords'))
    }

    // If the sibling row is not in cachedRows, load more data
    if (siblingIndex >= sortedIndices.length) {
      await loadData({
        offset: sortedIndices[sortedIndices.length - 1] + 1,
        limit: 10,
      })
      sortedIndices.push(
        ...Array.from(dataCache.cachedRows.value.keys())
          .filter((key) => !sortedIndices.includes(key))
          .sort((a, b) => a - b),
      )
    }

    // Extract the row id of the sibling row
    const siblingRow = dataCache.cachedRows.value.get(sortedIndices[siblingIndex])
    if (siblingRow) {
      const rowId = extractPkFromRow(siblingRow.row, meta.value?.columns as ColumnType[])
      if (rowId) {
        await router.push({
          query: {
            ...routeQuery.value,
            rowId,
          },
        })
      }
    }
  }

  const fetchMissingChunks = async (startIndex: number, endIndex: number, path: Array<number> = []) => {
    const firstChunkId = Math.floor(startIndex / CHUNK_SIZE)
    const lastChunkId = Math.floor(endIndex / CHUNK_SIZE)

    const dataCache = getDataCache(path)

    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !dataCache.chunkStates.value[chunkId],
    )
    await Promise.all(chunksToFetch.map(fetchChunk, path))
  }

  // Remove invalid and moved(group change) rows from the cache
  function clearInvalidRows(
    path: Array<number> = [],
    callbackFns?: {
      onGroupRowChange?: (params: { row: Row; property: string; groupByColumn: ColumnType; level: number }) => void
    },
  ) {
    const dataCache = getDataCache(path)
    const sortedEntries = Array.from(dataCache.cachedRows.value.entries()).sort(([indexA], [indexB]) => indexA - indexB)

    const invalidIndexes = sortedEntries
      .filter(([_, row]) => row.rowMeta.isValidationFailed || row.rowMeta.isGroupChanged)
      .map(([index]) => index)

    if (invalidIndexes.length === 0) return

    for (const index of invalidIndexes) {
      const row = dataCache.cachedRows.value.get(index)

      if (row.rowMeta?.isGroupChanged) {
        const groupByColumn = groupByColumns.value[row.rowMeta.changedGroupIndex]
        const property = groupByColumn?.column?.title
        // invoke group by callback
        callbackFns?.onGroupRowChange?.({
          row,
          property,
          groupByColumn,
          level: row.rowMeta.changedGroupIndex,
          path: row.rowMeta.path,
        })
      }

      dataCache.cachedRows.value.delete(index)
    }

    const newCachedRows = new Map<number, Row>()

    for (const [oldIndex, row] of sortedEntries) {
      if (!invalidIndexes.includes(oldIndex)) {
        const newIndex = oldIndex - invalidIndexes.filter((i) => i < oldIndex).length
        row.rowMeta.rowIndex = newIndex
        newCachedRows.set(newIndex, row)
      }
    }

    dataCache.chunkStates.value[getChunkIndex(Math.max(...invalidIndexes))] = undefined

    const indices = new Set<number>()
    for (const [_, row] of newCachedRows) {
      if (indices.has(row.rowMeta.rowIndex)) {
        console.error('Op: clearInvalidRows:  Duplicate index detected:', row.rowMeta.rowIndex)
        break
      }
      indices.add(row.rowMeta.rowIndex)
    }

    dataCache.cachedRows.value = newCachedRows

    dataCache.totalRows.value = Math.max(0, (dataCache.totalRows.value || 0) - invalidIndexes.length)
    callbacks?.syncVisibleData?.()
  }

  const willSortOrderChange = ({
    row,
    newData,
    path,
  }: {
    row: Row
    newData: Record<string, any>
    path: Array<number>
  }): boolean => {
    if (!sorts.value.length) return false

    const currentIndex = row.rowMeta.rowIndex!
    if (currentIndex === undefined) return true

    const dataCache = getDataCache(path)

    const indices = Array.from(dataCache.cachedRows.value.keys()).sort((a, b) => a - b)
    const currentPos = indices.indexOf(currentIndex)
    const prevRow = currentPos > 0 ? dataCache.cachedRows.value.get(indices[currentPos - 1]) : null
    const nextRow = currentPos < indices.length - 1 ? dataCache.cachedRows.value.get(indices[currentPos + 1]) : null

    const updatedRow = {
      ...row,
      row: {
        ...row.row,
        ...newData,
      },
    }

    if (prevRow) {
      let shouldBeBefore = false
      let isDifferent = false

      for (const sort of sorts.value) {
        const column = columnsById.value[sort.fk_column_id!]
        if (!column?.title) continue

        const direction = sort.direction || 'asc'
        const comparison = sortByUIType({
          uidt: column.uidt as UITypes,
          a: updatedRow.row[column.title],
          b: prevRow.row[column.title],
          options: { direction },
        })

        if (comparison !== 0) {
          isDifferent = true
          shouldBeBefore = comparison < 0
          break
        }
      }

      if (isDifferent && shouldBeBefore) return true
    }

    if (nextRow) {
      let shouldBeAfter = false
      let isDifferent = false

      for (const sort of sorts.value) {
        const column = columnsById.value[sort.fk_column_id!]
        if (!column?.title) continue

        const direction = sort.direction || 'asc'
        const comparison = sortByUIType({
          uidt: column.uidt as UITypes,
          a: updatedRow.row[column.title],
          b: nextRow.row[column.title],
          options: { direction },
        })

        if (comparison !== 0) {
          isDifferent = true
          shouldBeAfter = comparison > 0
          break
        }
      }

      if (isDifferent && shouldBeAfter) return true
    }

    return false
  }

  const getContinuousRanges = (cachedRows: Map<number, Row>) => {
    const indexes = Array.from(cachedRows.keys()).sort((a, b) => a - b)
    const ranges: { start: number; end: number }[] = []

    let rangeStart = indexes[0]
    let prev = indexes[0]

    for (let i = 1; i <= indexes.length; i++) {
      const current = indexes[i]
      if (current !== prev + 1) {
        ranges.push({ start: rangeStart, end: prev })
        rangeStart = current
      }
      prev = current
    }

    return ranges
  }

  const applySorting = (rows: Row | Row[], path: Array<number> = []) => {
    if (!sorts.value.length) return
    const dataCache = getDataCache(path)
    const orderedSorts = sorts.value.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const inputRows = Array.isArray(rows) ? rows : [rows]
    const ranges = getContinuousRanges(dataCache.cachedRows.value)

    inputRows.forEach((inputRow) => {
      const originalIndex = inputRow.rowMeta.rowIndex!
      const sourceRange = ranges.find((r) => originalIndex >= r.start && originalIndex <= r.end)
      if (!sourceRange) return

      const rangeEntries = Array.from(dataCache.cachedRows.value.entries())
        .filter(([index]) => index >= sourceRange.start && index <= sourceRange.end)
        .map(([index, row]) => ({
          currentIndex: index,
          row,
          pk: extractPkFromRow(row.row, meta.value?.columns ?? []),
        }))

      const sortedRangeEntries = rangeEntries.sort((a, b) => {
        for (const sort of orderedSorts) {
          const column = columnsById.value[sort.fk_column_id!]?.title
          if (!column) continue

          const direction = sort.direction || 'asc'
          const comparison = sortByUIType({
            uidt: columnsById.value[sort.fk_column_id!].uidt as UITypes,
            a: a.row.row[column],
            b: b.row.row[column],
            options: { direction },
          })

          if (comparison !== 0) return comparison
        }
        return a.currentIndex - b.currentIndex
      })

      const entry = sortedRangeEntries.find((e) => e.pk === extractPkFromRow(inputRow.row, meta.value?.columns ?? []))

      if (!entry) return

      const targetIndex = sourceRange.start + sortedRangeEntries.indexOf(entry)

      const newCachedRows = new Map(dataCache.cachedRows.value)

      if (targetIndex !== originalIndex) {
        if (targetIndex < originalIndex) {
          // Move up
          for (let i = originalIndex - 1; i >= targetIndex; i--) {
            const row = newCachedRows.get(i)
            if (row) {
              row.rowMeta.rowIndex = i + 1
              row.rowMeta.isRowOrderUpdated = false
              newCachedRows.set(i + 1, row)
            }
          }
        } else {
          // Move down
          for (let i = originalIndex + 1; i <= targetIndex; i++) {
            const row = newCachedRows.get(i)
            if (row) {
              row.rowMeta.rowIndex = i - 1
              row.rowMeta.isRowOrderUpdated = false
              newCachedRows.set(i - 1, row)
            }
          }
        }

        // Place the input row at its new position
        inputRow.rowMeta.rowIndex = targetIndex
        inputRow.rowMeta.isRowOrderUpdated = false
        newCachedRows.set(targetIndex, inputRow)

        const targetChunkIndex = getChunkIndex(targetIndex)

        if (targetIndex <= sourceRange.start || targetIndex >= sourceRange.end) {
          if (targetIndex <= sourceRange.start) {
            for (let i = 0; i <= targetChunkIndex; i++) {
              dataCache.chunkStates.value[i] = undefined
            }
          } else if (targetIndex >= sourceRange.end) {
            for (let i = targetChunkIndex; i <= getChunkIndex(dataCache.totalRows.value - 1); i++) {
              dataCache.chunkStates.value[i] = undefined
            }
          }
        }
      } else {
        inputRow.rowMeta.isRowOrderUpdated = false
      }

      const indices = new Set<number>()
      for (const [_, row] of newCachedRows) {
        if (indices.has(row.rowMeta.rowIndex)) {
          console.error('Op: applySorting:  Duplicate index detected:', row.rowMeta.rowIndex)
          break
        }
        indices.add(row.rowMeta.rowIndex)
      }

      dataCache.cachedRows.value = newCachedRows
    })

    callbacks?.syncVisibleData?.()
  }

  function addEmptyRow(newRowIndex?: number, metaValue = meta.value, rowOverwrite = {}, path: Array<number> = []) {
    const dataCache = getDataCache(path)

    if (ncIsUndefined(newRowIndex) || ncIsNull(newRowIndex)) {
      newRowIndex = dataCache.totalRows.value
    }

    if (dataCache.cachedRows.value.has(newRowIndex)) {
      const entriesToShift = Array.from(dataCache.cachedRows.value.entries())
        .filter(([index]) => index >= newRowIndex)
        .sort((a, b) => b[0] - a[0])

      for (const [index, rowData] of entriesToShift) {
        const shiftedRowData = {
          ...rowData,
          rowMeta: {
            ...rowData.rowMeta,
            rowIndex: index + 1,
          },
        }
        dataCache.cachedRows.value.set(index + 1, shiftedRowData)
      }
    }

    const newRow = {
      row: { ...rowDefaultData(metaValue?.columns), ...rowOverwrite },
      oldRow: {},
      rowMeta: { new: true, rowIndex: newRowIndex, path },
    }
    dataCache.cachedRows.value.set(newRowIndex, newRow)

    dataCache.totalRows.value++
    callbacks?.syncVisibleData?.()

    return newRow
  }

  const linkRecord = async (
    rowId: string,
    relatedRowId: string,
    column: ColumnType,
    type: RelationTypes,
    { metaValue = meta.value }: { metaValue?: TableType } = {},
    options?: { suppressError?: boolean },
  ): Promise<void> => {
    try {
      await $api.dbTableRow.nestedAdd(
        NOCO,
        base.value.id as string,
        metaValue?.id as string,
        encodeURIComponent(rowId),
        type,
        column.title as string,
        encodeURIComponent(relatedRowId),
      )
    } catch (e: any) {
      if (!options?.suppressError) {
        const errorMessage = await extractSdkResponseErrorMsg(e)
        message.error(`Failed to link record: ${errorMessage}`)
      }
      throw e
    }
    callbacks?.syncVisibleData?.()
  }

  const recoverLTARRefs = async (
    row: Record<string, any>,
    { metaValue = meta.value }: { metaValue?: TableType } = {},
    options?: { suppressError?: boolean },
  ) => {
    const id = extractPkFromRow(row, metaValue?.columns as ColumnType[])

    if (!id) return

    for (const column of metaValue?.columns ?? []) {
      if (column.uidt !== UITypes.LinkToAnotherRecord) continue

      const colOptions = column.colOptions as LinkToAnotherRecordType

      const relatedTableMeta = metas.value?.[colOptions?.fk_related_model_id as string]

      if (isHm(column) || isMm(column)) {
        const relatedRows = (row[column.title!] ?? []) as Record<string, any>[]

        for (const relatedRow of relatedRows) {
          const relatedId = extractPkFromRow(relatedRow, relatedTableMeta?.columns as ColumnType[])
          if (relatedId) {
            await linkRecord(id, relatedId, column, colOptions.type as RelationTypes, { metaValue: relatedTableMeta }, options)
          }
        }
      } else if (isBt(column) && row[column.title!]) {
        const relatedId = extractPkFromRow(row[column.title!] as Record<string, any>, relatedTableMeta.columns as ColumnType[])

        if (relatedId) {
          await linkRecord(id, relatedId, column, colOptions.type as RelationTypes, { metaValue: relatedTableMeta }, options)
        }
      }
    }
    callbacks?.syncVisibleData?.()
  }

  async function deleteRow(rowIndex: number, undo = false, path: Array<number> = []) {
    const dataCache = getDataCache(path)
    try {
      const row = dataCache.cachedRows.value.get(rowIndex)
      if (!row) return

      if (!row.rowMeta.new) {
        const id = meta?.value?.columns
          ?.filter((c) => c.pk)
          .map((c) => row.row[c.title!])
          .join('___')

        const fullRecord = await $api.dbTableRow.read(
          NOCO,
          base?.value.id as string,
          meta.value?.id as string,
          encodeURIComponent(id as string),
          {
            getHiddenColumn: true,
          },
        )

        const deleted = await deleteRowById(id as string, undefined, path)
        if (!deleted) {
          return
        }

        row.row = fullRecord

        if (!undo) {
          addUndo({
            undo: {
              fn: async (row: Row, ltarState: Record<string, any>, path: Array<number>) => {
                const pkData = rowPkData(row.row, meta?.value?.columns as ColumnType[])

                row.row = { ...pkData, ...row.row }

                await insertRow(row, ltarState, {}, true, undefined, undefined, path)
                // refreshing the view
                dataCache.cachedRows.value.clear()
                dataCache.chunkStates.value = []

                try {
                  await recoverLTARRefs(row.row, undefined, { suppressError: true })
                } catch (ex) {
                  // expected and silenced
                  // the relation should already exists on above operation (insertRow)
                  // this is left to keep things unchanged
                }
              },
              args: [clone(row), {}, clone(path)],
            },
            redo: {
              fn: async (rowIndex: number, path) => {
                await deleteRow(rowIndex, false, path)
              },
              args: [rowIndex, clone(path)],
            },
            scope: defineViewScope({ view: viewMeta.value }),
          })
        }
      }

      dataCache.cachedRows.value.delete(rowIndex)

      const rows = Array.from(dataCache.cachedRows.value.entries())
      const rowsToShift = rows.filter(([index]) => index > rowIndex)
      rowsToShift.sort((a, b) => a[0] - b[0])

      for (const [index, row] of rowsToShift) {
        const newIndex = index - 1
        row.rowMeta.rowIndex = newIndex
        dataCache.cachedRows.value.delete(index)
        dataCache.cachedRows.value.set(newIndex, row)
      }

      if (rowsToShift.length) {
        dataCache.chunkStates.value[getChunkIndex(rowsToShift[rowsToShift.length - 1][0])] = undefined
      }

      dataCache.totalRows.value = (dataCache.totalRows.value || 0) - 1
      await syncCount(path)
      callbacks?.syncVisibleData?.()
    } catch (e: any) {
      console.error(e)

      message.error(`${t('msg.error.deleteRowFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  async function insertRow(
    currentRow: Row,
    ltarState: Record<string, any> = {},
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
    ignoreShifting = false,
    beforeRowID?: string,
    path: Array<number> = [],
  ): Promise<Record<string, any> | undefined> {
    if (!currentRow.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    const dataCache = getDataCache(path)

    currentRow.rowMeta.saving = true

    try {
      const { missingRequiredColumns, insertObj } = await populateInsertObject({
        meta: metaValue!,
        ltarState,
        getMeta,
        row: currentRow.row,
        undo,
      })

      if (missingRequiredColumns.size) {
        return
      }

      const insertedData = await $api.dbViewRow.create(
        NOCO,
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        { ...insertObj, ...(ltarState || {}) },
        { before: beforeRowID, undo },
      )

      currentRow.rowMeta.new = false

      Object.assign(currentRow.row, {
        ...(currentRow.row ?? {}),
        ...rowPkData(insertedData, metaValue?.columns as ColumnType[]),
      })

      const insertIndex = currentRow.rowMeta.rowIndex!

      /*   if (cachedRows.value.has(insertIndex) && !ignoreShifting) {
        const rows = Array.from(cachedRows.value.entries())
        const rowsToShift = rows.filter(([index]) => index >= insertIndex)
        rowsToShift.sort((a, b) => b[0] - a[0]) // Sort in descending order

        for (const [index, row] of rowsToShift) {
          row.rowMeta.rowIndex = index + 1
          cachedRows.value.set(index + 1, row)
        }
      }
*/
      if (!undo) {
        Object.assign(currentRow.oldRow, insertedData)

        const id = extractPkFromRow(insertedData, metaValue!.columns as ColumnType[])
        const pkData = rowPkData(insertedData, metaValue?.columns as ColumnType[])

        addUndo({
          undo: {
            fn: async (
              id: string,
              tempLocalCache: Map<number, Row>,
              tempTotalRows: number,
              tempChunkStates: Array<'loading' | 'loaded' | undefined>,
              path: Array<number>,
            ) => {
              dataCache.cachedRows.value = new Map(tempLocalCache)
              dataCache.totalRows.value = tempTotalRows
              dataCache.chunkStates.value = tempChunkStates

              await deleteRowById(id, undefined, path)
              dataCache.cachedRows.value.delete(insertIndex)

              for (const [index, row] of dataCache.cachedRows.value) {
                if (index > insertIndex) {
                  row.rowMeta.rowIndex = index - 1
                  dataCache.cachedRows.value.set(index - 1, row)
                }
              }
              dataCache.totalRows.value = dataCache.totalRows.value! - 1
              callbacks?.syncVisibleData?.()
            },
            args: [
              id,
              clone(new Map(dataCache.cachedRows.value)),
              clone(dataCache.totalRows.value),
              clone(dataCache.chunkStates.value),
              clone(path),
            ],
          },
          redo: {
            fn: async (
              row: Row,
              ltarState: Record<string, any>,
              tempLocalCache: Map<number, Row>,
              tempTotalRows: number,
              tempChunkStates: Array<'loading' | 'loaded' | undefined>,
              rowID: string,
              path: Array<number>,
            ) => {
              dataCache.cachedRows.value = new Map(tempLocalCache)
              dataCache.totalRows.value = tempTotalRows
              dataCache.chunkStates.value = tempChunkStates

              row.row = { ...pkData, ...row.row }
              const newData = await insertRow(row, ltarState, undefined, true, true, rowID)

              const needsResorting = willSortOrderChange({
                row,
                newData,
                path,
              })

              if (needsResorting) {
                const newRow = dataCache.cachedRows.value.get(row.rowMeta.rowIndex!)
                if (newRow) newRow.rowMeta.isRowOrderUpdated = needsResorting
              }
              callbacks?.syncVisibleData?.()
            },
            args: [
              clone(currentRow),
              clone(ltarState),
              clone(new Map(dataCache.cachedRows.value)),
              clone(dataCache.totalRows.value),
              clone(dataCache.chunkStates.value),
              clone(beforeRowID),
              clone(path),
            ],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      if (dataCache.cachedRows.value.has(insertIndex) && !ignoreShifting) {
        const rows = Array.from(dataCache.cachedRows.value.entries())
        const rowsToShift = rows.filter(([index]) => index >= insertIndex)
        rowsToShift.sort((a, b) => b[0] - a[0]) // Sort in descending order

        for (const [index, row] of rowsToShift) {
          row.rowMeta.rowIndex = index + 1
          dataCache.cachedRows.value.set(index + 1, row)
        }
      }

      dataCache.cachedRows.value.set(insertIndex, {
        row: { ...insertedData, ...currentRow.row },
        oldRow: { ...insertedData },
        rowMeta: {
          ...currentRow.rowMeta,
          rowIndex: insertIndex,
          new: false,
          saving: false,
        },
      })

      if (!ignoreShifting) {
        dataCache.totalRows.value++
      }
      callbacks?.reloadAggregate?.({ path })
      callbacks?.syncVisibleData?.()

      return insertedData
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to insert row: ${errorMessage}`)
      throw error
    } finally {
      currentRow.rowMeta.saving = false
    }
  }

  async function updateRowProperty(
    toUpdate: Row,
    property: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    undo = false,
    path: Array<number> = [],
  ): Promise<Record<string, any> | undefined> {
    if (!toUpdate.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    const dataCache = getDataCache(path)

    toUpdate.rowMeta.saving = true

    try {
      const id = extractPkFromRow(toUpdate.row, metaValue?.columns as ColumnType[])

      const updatedRowData: Record<string, any> = await $api.dbViewRow.update(
        NOCO,
        base?.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        encodeURIComponent(id),
        {
          [property]: toUpdate.row[property] ?? null,
        },
      )

      if (!undo) {
        addUndo({
          undo: {
            fn: async (
              toUpdate: Row,
              property: string,
              previousCache: Map<number, Row>,
              tempTotalRows: number,
              path: Array<number>,
            ) => {
              dataCache.cachedRows.value = new Map(previousCache)
              dataCache.totalRows.value = tempTotalRows

              await updateRowProperty(
                { row: toUpdate.oldRow, oldRow: toUpdate.row, rowMeta: toUpdate.rowMeta },
                property,
                undefined,
                true,
                path,
              )
            },
            args: [
              clone(toUpdate),
              property,
              clone(new Map(dataCache.cachedRows.value)),
              clone(dataCache.totalRows.value),
              clone(path),
            ],
          },
          redo: {
            fn: async (toUpdate: Row, property: string, path) => {
              await updateRowProperty(toUpdate, property, undefined, true, path)
            },
            args: [clone(toUpdate), property, clone(path)],
          },
          scope: defineViewScope({ view: viewMeta.value }),
        })
      }

      // Update specific columns based on their types
      const columnsToUpdate = new Set([
        UITypes.Formula,
        UITypes.QrCode,
        UITypes.Barcode,
        UITypes.Rollup,
        UITypes.Checkbox,
        UITypes.User,
        UITypes.LastModifiedTime,
        UITypes.LastModifiedBy,
        UITypes.Lookup,
        UITypes.Button,
        UITypes.Attachment,
      ])

      Object.assign(
        toUpdate.row,
        metaValue?.columns?.reduce<Record<string, any>>((acc, col: ColumnType) => {
          if (
            col.title &&
            col.title in updatedRowData &&
            (columnsToUpdate.has(col.uidt as UITypes) ||
              isAIPromptCol(col) ||
              col.au ||
              (isValidValue(col?.cdf) && / on update /i.test(col.cdf as string)))
          ) {
            acc[col.title] = updatedRowData[col.title]
          }
          return acc
        }, {}),
      )

      Object.assign(toUpdate.oldRow, updatedRowData)

      // Update the row in cachedRows
      if (toUpdate.rowMeta.rowIndex !== undefined) {
        dataCache.cachedRows.value.set(toUpdate.rowMeta.rowIndex, toUpdate)
      }
      callbacks?.reloadAggregate?.({ fields: [{ title: property }], path })

      callbacks?.syncVisibleData?.()

      if (undo) {
        applySorting(toUpdate, path)
      }

      return updatedRowData
    } catch (e: any) {
      toUpdate.row[property] = toUpdate.oldRow[property]
      const errorMessage = await extractSdkResponseErrorMsg(e)
      message.error(`${t('msg.error.rowUpdateFailed')}: ${errorMessage}`)
      throw e
    } finally {
      toUpdate.rowMeta.saving = false
    }
  }

  async function updateOrSaveRow(
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    beforeRowID?: string,
    path: Array<number> = [],
  ): Promise<void> {
    if (!row.rowMeta) {
      throw new Error('Row metadata is missing')
    }

    const dataCache = getDataCache(path)

    row.rowMeta.changed = false
    let cachedRow

    await new Promise((resolve) => {
      const checkStatus = () => {
        cachedRow = dataCache.cachedRows.value.get(row.rowMeta.rowIndex!)
        // Wait until either the row is not saving OR the row is not new
        const isComplete = !cachedRow?.rowMeta?.saving || !cachedRow?.rowMeta?.new

        if (isComplete) {
          resolve(true)
        } else {
          setTimeout(checkStatus, 100)
        }
      }

      // Start checking
      checkStatus()
    })

    let data

    const fieldsToOverwrite = meta.value?.columns?.filter(
      (c) =>
        isSystemColumn(c) ||
        isCreatedOrLastModifiedByCol(c) ||
        isCreatedOrLastModifiedTimeCol(c) ||
        [
          UITypes.Formula,
          UITypes.QrCode,
          UITypes.Barcode,
          UITypes.Rollup,
          UITypes.Checkbox,
          UITypes.User,
          UITypes.Lookup,
          UITypes.Button,
          UITypes.Attachment,
        ].includes(c.uidt),
    )

    if (row.rowMeta.new) {
      data = await insertRow(row, ltarState, args, false, true, beforeRowID, path)
    } else if (property) {
      if (cachedRow) {
        Object.assign(row.row, {
          ...(fieldsToOverwrite?.reduce((acc, col) => {
            acc[col.title!] = cachedRow.row[col.title!]
            return acc
          }, {}) ?? {}),
        })
      }
      data = await updateRowProperty(row, property, args, false, path)
    }

    row.rowMeta.isValidationFailed = !validateRowFilters(
      [...allFilters.value, ...computedWhereFilter.value],
      data,
      meta.value?.columns as ColumnType[],
      getBaseType(viewMeta.value?.view?.source_id),
      metas.value,
    )

    // check if the column is part of group by and value changed
    if (row.rowMeta?.path?.length && groupByColumns?.value) {
      const index = groupByColumns.value.findIndex((c) => c.column.title === property)
      if (index > -1) {
        // check if column is group by and value changed
        row.rowMeta.isGroupChanged = true
        row.rowMeta.changedGroupIndex = index
      }
    }

    const changedFields = property ? [property] : Object.keys(row.row)

    changedFields.push(
      ...(meta.value
        ?.columns!.filter((c) =>
          [
            UITypes.LastModifiedBy,
            UITypes.LastModifiedTime,
            UITypes.Formula,
            UITypes.Lookup,
            UITypes.Rollup,
            UITypes.LinkToAnotherRecord,
          ].includes(c.uidt as UITypes),
        )
        .map((c) => c.title!) || []),
    )

    if (isSortRelevantChange(changedFields, sorts.value, columnsById.value)) {
      const needsResorting = willSortOrderChange({
        row,
        newData: data,
        sorts: sorts.value,
        path,
      })

      const newRow = dataCache.cachedRows.value.get(row.rowMeta.rowIndex!)
      if (newRow) newRow.rowMeta.isRowOrderUpdated = needsResorting
    }
    callbacks?.syncVisibleData?.()
  }

  async function bulkUpdateView(
    data: Record<string, any>[],
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    path: Array<number> = [],
  ): Promise<void> {
    if (!viewMetaValue) {
      throw new Error('View meta value is missing')
    }

    await $api.dbTableRow.bulkUpdateAll(NOCO, metaValue?.base_id as string, metaValue?.id as string, data, {
      viewId: viewMetaValue.id,
    })

    callbacks?.reloadAggregate?.({ path })
    callbacks?.syncVisibleData?.()
  }

  async function deleteRowById(
    id: string,
    { metaValue = meta.value, viewMetaValue = viewMeta.value }: { metaValue?: TableType; viewMetaValue?: ViewType } = {},
    path: Array<number> = [],
  ): Promise<boolean> {
    if (!id) {
      throw new Error("Delete not allowed for table which doesn't have primary Key")
    }

    try {
      const res: any = await $api.dbViewRow.delete(
        'noco',
        base.value.id as string,
        metaValue?.id as string,
        viewMetaValue?.id as string,
        encodeURIComponent(id),
      )

      callbacks?.reloadAggregate?.({ path })

      if (res.message) {
        const errorMessage = `Unable to delete record with ID ${id} because of the following:\n${res.message.join(
          '\n',
        )}.\nClear the data first & try again`
        message.info(`Record delete failed: ${errorMessage}`)
        return false
      }

      return true
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`${t('msg.error.deleteRowFailed')}: ${errorMessage}`)
      return false
    }
  }

  const removeRowIfNew = (row: Row, path: Array<number> = []): boolean => {
    path = row?.rowMeta?.path ?? []
    const dataCache = getDataCache(path)
    const index = Array.from(dataCache.cachedRows.value.entries()).find(
      ([_, r]) => r.rowMeta.rowIndex === row.rowMeta.rowIndex,
    )?.[0]
    if (index !== undefined && row.rowMeta.new) {
      dataCache.cachedRows.value.delete(index)
      dataCache.totalRows.value--
      return true
    }
    callbacks?.syncVisibleData?.()
    return false
  }

  async function syncCount(path: Array<number> = []): Promise<void> {
    if (!isPublic?.value && (!base?.value?.id || !meta.value?.id || !viewMeta.value?.id)) return

    const dataCache = getDataCache(path)

    const whereFilter = callbacks?.getWhereFilter?.(path)

    try {
      const { count } = isPublic?.value
        ? await fetchCount({
            filtersArr: nestedFilters.value,
            where: whereFilter,
          })
        : await $api.dbViewRow.count(NOCO, base?.value?.id as string, meta.value!.id as string, viewMeta?.value?.id as string, {
            where: whereFilter,
          })

      dataCache.totalRows.value = count as number
      callbacks?.syncVisibleData?.()
    } catch (error: any) {
      const errorMessage = await extractSdkResponseErrorMsg(error)
      message.error(`Failed to sync count: ${errorMessage}`)
      throw error
    }
  }

  function getExpandedRowIndex(path: Array<number>): number {
    const rowId = routeQuery.value.rowId
    if (!rowId) return -1
    const dataCache = getDataCache(path)

    for (const [_index, row] of dataCache.cachedRows.value.entries()) {
      if (extractPkFromRow(row.row, meta.value?.columns as ColumnType[]) === rowId) {
        return row.rowMeta.rowIndex!
      }
    }
    return -1
  }

  // function which waits for the data to be loaded and then returns the expanded row index
  async function getExpandedRowIndexWithWait(path: Array<number>): Promise<number> {
    const rowId = routeQuery.value.rowId
    if (!rowId) return -1

    const dataCache = getDataCache(path)

    await until(() => dataCache.chunkStates.value?.every((v) => v !== 'loading')).toBeTruthy({
      timeout: 5000,
    })

    return getExpandedRowIndex(path)
  }

  const isLastRow = computed(() => {
    const path = (routeQuery.value?.path?.split('-') ?? []).map((c) => +c)
    const dataCache = getDataCache(path)

    const expandedRowIndex = getExpandedRowIndex(path)
    if (expandedRowIndex === -1) return false

    return expandedRowIndex === dataCache.totalRows.value - 1
  })

  const isFirstRow = computed(() => {
    const path = (routeQuery.value?.path?.split('-') ?? []).map((c) => +c)

    const expandedRowIndex = getExpandedRowIndex(path)
    if (expandedRowIndex === -1) return false

    return expandedRowIndex === 0
  })

  async function getRows(startIndex: number, endIndex: number, path: Array<number> = []): Promise<Array<Row>> {
    const startChunkId = getChunkIndex(startIndex)
    const endChunkId = getChunkIndex(endIndex)

    const chunksToFetch = new Set<number>()
    for (let chunkId = startChunkId; chunkId <= endChunkId; chunkId++) {
      chunksToFetch.add(chunkId)
    }

    await Promise.all([...chunksToFetch].map((chunkId) => fetchChunk(chunkId, path)))

    const dataCache = getDataCache(path)

    const rows = []
    for (let rowId = startIndex; rowId <= endIndex; rowId++) {
      if (dataCache.cachedRows.value.has(rowId)) {
        rows.push(dataCache.cachedRows.value.get(rowId))
      }
    }

    callbacks?.syncVisibleData?.()

    return rows
  }

  return {
    getDataCache,
    insertRow,
    updateRowProperty,
    addEmptyRow,
    deleteRow,
    deleteRowById,
    getChunkIndex,
    fetchMissingChunks,
    fetchChunk,
    updateOrSaveRow,
    bulkUpdateView,
    removeRowIfNew,
    cachedRows,
    recoverLTARRefs,
    totalRows,
    clearCache,
    syncCount,
    selectedRows,
    chunkStates,
    isRowSortRequiredRows,
    clearInvalidRows,
    applySorting,
    CHUNK_SIZE,
    loadData,
    isLastRow,
    isFirstRow,
    getExpandedRowIndex,
    loadAggCommentsCount,
    navigateToSiblingRow,
    updateRecordOrder,
    selectedAllRecords,
    getRows,
    groupDataCache,
  }
}

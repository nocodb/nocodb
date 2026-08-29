import {
  type ColumnType,
  CommonAggregations,
  type FilterType,
  type LinkToAnotherRecordType,
  type LookupType,
  type TableType,
  UITypes,
  type ViewType,
} from 'nocodb-sdk'
import { createGroupUniqueIdentifier, generateGroupPath } from '../components/smartsheet/grid/canvas/utils/groupby'
import type { CanvasGroup } from '#imports'
import { groupKeysManager } from '#imports'

const GROUP_CHUNK_SIZE = 100
const MAX_GROUP_CACHE_SIZE = 100

const getSortParams = (sort: string) => {
  if (sort === 'asc') return '+'
  if (sort === 'desc') return '-'
  if (sort === 'count-asc') return '~+'
  if (sort === 'count-desc') return '~-'
  return '+'
}

export const useInfiniteGroups = (
  view: Ref<ViewType | undefined>,
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  where: ComputedRef<string | undefined>,
  callbacks: {
    syncVisibleData: () => void
  },
) => {
  const { gridViewCols } = useViewColumnsOrThrow()
  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)
  const { $api } = useNuxtApp()
  const { getMeta, metas } = useMetas()
  const { appInfo } = useGlobal()
  const { nestedFilters, sorts } = useSmartsheetStoreOrThrow()
  const { fetchBulkAggregatedData, sharedView } = useSharedView()
  const router = useRouter()
  const isPublic = inject(IsPublicInj, ref(false))
  const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

  /**
   * Present when mounted inside an interface page — group header/count loads
   * are routed through the adapter (interface-scoped ops) instead of the
   * view / shared-view endpoints, and group aggregations are skipped.
   */
  const interfaceDataApi = inject(InterfacePageDataInj, undefined)

  const routeQuery = computed(() => router.currentRoute.value.query as Record<string, string>)

  const columnsById = computed(() => {
    if (!meta.value?.columns?.length) return {}
    return meta.value?.columns.reduce((acc, column) => {
      acc[column.id!] = column
      return acc
    }, {} as Record<string, ColumnType>)
  })

  const gridViewColByTitle = computed(() => {
    return Object.values(gridViewCols.value).reduce((prev, curr) => {
      const title = curr.title
      prev[title] = curr
      return prev
    }, {})
  })

  const { groupBy: injectedGroupBy, hideEmptyGroups } = useViewGroupByOrThrow()

  const groupByColumns = computed(() => injectedGroupBy.value)

  const appendHideEmptyWhere = (colTitle: string | undefined, existingWhere?: string) => {
    if (!hideEmptyGroups?.value || !colTitle) return existingWhere
    const hideFilter = `(${colTitle},notblank)`
    return existingWhere ? `${existingWhere}~and${hideFilter}` : hideFilter
  }

  const cachedGroups = ref<Map<number, CanvasGroup>>(new Map())
  const totalGroups = ref(0)
  const chunkStates = ref<Array<'loading' | 'loaded' | 'failed' | undefined>>([])

  // Canvas-level retry cap: stop re-triggering the same chunk after this many
  // consecutive failures. Each canvas attempt internally retries the API call
  // GROUPBY_MAX_RETRIES + 1 times — so total backend hits is bounded by
  // CANVAS_MAX_CHUNK_FETCH_ATTEMPTS * (GROUPBY_MAX_RETRIES + 1).
  const CANVAS_MAX_CHUNK_FETCH_ATTEMPTS = 3
  const GROUPBY_MAX_RETRIES = 3
  const GROUPBY_RETRY_DELAY_MS = 50
  const chunkFailureCounts = new Map<string, number>()
  const getChunkKey = (chunkId: number, parentGroup?: CanvasGroup) =>
    `${parentGroup ? generateGroupPath(parentGroup) : 'root'}:${chunkId}`

  // Viewport-lazy aggregation loading — groups queue here when they become
  // visible and flush as one debounced bulkAggregate request.
  const AGGREGATION_FETCH_DEBOUNCE_MS = 200
  const AGGREGATION_MAX_FETCH_ATTEMPTS = 2
  const pendingAggregationGroups = new Map<string, CanvasGroup>()
  const aggregationFailureCounts = new Map<string, number>()
  let aggregationFlushTimer: ReturnType<typeof setTimeout> | null = null

  const hasAggregations = computed(() =>
    Object.values(gridViewCols.value).some((f) => f.aggregation && f.aggregation !== CommonAggregations.None),
  )

  onBeforeUnmount(() => {
    if (aggregationFlushTimer) {
      clearTimeout(aggregationFlushTimer)
      aggregationFlushTimer = null
    }
  })

  const getGroupChunkIndex = (offset: number) => Math.floor(offset / GROUP_CHUNK_SIZE)

  const colors = ref(enumColor.light)

  const nextGroupColor = ref(colors.value[0])

  const getNextColor = () => {
    const tempColor = nextGroupColor.value
    const index = colors.value.indexOf(nextGroupColor.value)
    if (index === colors.value.length - 1) {
      nextGroupColor.value = colors.value[0]
    } else {
      nextGroupColor.value = colors.value[index + 1]
    }
    return tempColor
  }

  const fetchGroupChunk = async (chunkId: number, parentGroup?: CanvasGroup, force = false) => {
    const targetChunkStates = parentGroup ? parentGroup.chunkStates : chunkStates.value
    const chunkKey = getChunkKey(chunkId, parentGroup)

    if (
      targetChunkStates[chunkId] === 'loading' ||
      (targetChunkStates[chunkId] === 'loaded' && !force) ||
      (targetChunkStates[chunkId] === 'failed' && !force)
    )
      return

    // User-initiated re-fetch (force=true) — clear the failure counter so
    // we get a fresh CANVAS_MAX_CHUNK_FETCH_ATTEMPTS budget.
    if (force) chunkFailureCounts.delete(chunkKey)

    targetChunkStates[chunkId] = 'loading'
    const offset = chunkId * GROUP_CHUNK_SIZE
    const level = parentGroup ? findGroupLevel(parentGroup) : 0
    const groupCol = groupByColumns.value[level]

    // Interface pages fetch through the adapter (page/viz-scoped, incl. public
    // share) — it carries its own context, so `base.value.id` (unset on the
    // anonymous public route) must not gate the group-chunk load there.
    if (!groupCol || !view.value?.id || (!interfaceDataApi && !base.value?.id)) return

    try {
      const nestedGrpWhereArr = buildNestedFilterArr(parentGroup) ?? []

      const effectiveWhere = appendHideEmptyWhere(groupCol.column.title, where.value)

      let response: Awaited<ReturnType<typeof $api.dbViewRow.groupBy>> | undefined
      for (let attempt = 0; attempt <= GROUPBY_MAX_RETRIES; attempt++) {
        try {
          response = interfaceDataApi
            ? await interfaceDataApi.fetchGroupBy({
                offset,
                limit: GROUP_CHUNK_SIZE,
                where: effectiveWhere,
                sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}`,
                column_name: groupCol.column.title!,
                subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
                sortsArr: sorts.value,
                filtersArr: nestedFilters.value ?? [],
                // group-nesting predicate — must ride apart from `filtersArr`
                // (the server gates that on the Filter action; nesting always
                // applies)
                nestedFiltersArr: nestedGrpWhereArr,
              })
            : isPublic.value
            ? await $api.public.dataGroupBy(
                sharedView.value!.uuid!,
                {
                  offset,
                  limit: GROUP_CHUNK_SIZE,
                  where: effectiveWhere,
                  sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
                  column_name: groupCol.column.title,
                  subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
                  sortArrJson: JSON.stringify(sorts.value),
                  filterArrJson: JSON.stringify([...(nestedFilters.value ?? []), ...nestedGrpWhereArr]),
                },
                {
                  headers: {
                    'xc-password': sharedViewPassword.value,
                  },
                },
              )
            : await $api.dbViewRow.groupBy('noco', base.value.id, view.value.fk_model_id, view.value.id, {
                offset,
                limit: GROUP_CHUNK_SIZE,
                where: effectiveWhere,
                sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
                column_name: groupCol.column.title,
                sortArrJson: JSON.stringify(sorts.value),
                filterArrJson: JSON.stringify([...(nestedFilters.value || []), ...nestedGrpWhereArr]),
                subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
              })
          break
        } catch (err) {
          if (attempt === GROUPBY_MAX_RETRIES) throw err
          await new Promise((resolve) => setTimeout(resolve, GROUPBY_RETRY_DELAY_MS))
        }
      }
      if (!response) throw new Error('groupBy: empty response after retries')

      const groups: CanvasGroup[] = []
      for (const item of response.list) {
        let group: CanvasGroup = {} as any

        if (groupCol.column.uidt === UITypes.LinkToAnotherRecord) {
          const colOpts = groupCol.column.colOptions as LinkToAnotherRecordType
          const relatedBaseId = colOpts?.fk_related_base_id || (base.value?.id as string)
          const relatedTableMeta = await getMeta(relatedBaseId, colOpts.fk_related_model_id as string)
          if (!relatedTableMeta) continue
          group.relatedTableMeta = relatedTableMeta
          const col = relatedTableMeta.columns?.find((c) => c.pv) || relatedTableMeta.columns?.[0]
          group.relatedColumn = col
          group.displayValueProp = col?.title
        }

        if (groupCol.column.uidt === UITypes.Lookup) {
          const relationColumn = meta.value?.columns?.find(
            (c: ColumnType) => c.id === (groupCol.column?.colOptions as LookupType)?.fk_relation_column_id,
          )
          if (!relationColumn) continue

          const relColOpts = relationColumn.colOptions as LinkToAnotherRecordType
          const relatedBaseId = relColOpts?.fk_related_base_id || (base.value?.id as string)
          const relatedTableMeta = await getMeta(relatedBaseId, relColOpts.fk_related_model_id as string)
          if (!relatedTableMeta) continue

          const lookupColumn = relatedTableMeta.columns?.find(
            (c) => c.id === (groupCol.column.colOptions as LookupType)?.fk_lookup_column_id,
          )
          if (!lookupColumn) continue

          let finalTableMeta = relatedTableMeta
          let finalColumn = lookupColumn

          // Resolve nested lookups (Lookup → Lookup → ... → target column)
          while (finalColumn?.uidt === UITypes.Lookup) {
            const nestedRelCol = finalTableMeta.columns?.find(
              (c: ColumnType) => c.id === (finalColumn!.colOptions as LookupType)?.fk_relation_column_id,
            )
            if (!nestedRelCol) break

            const nestedRelOpts = nestedRelCol.colOptions as LinkToAnotherRecordType
            const nestedBaseId = nestedRelOpts?.fk_related_base_id || (base.value?.id as string)
            const nestedTableMeta = await getMeta(nestedBaseId, nestedRelOpts.fk_related_model_id as string)
            if (!nestedTableMeta) break

            const nestedLookupCol = nestedTableMeta.columns?.find(
              (c) => c.id === (finalColumn!.colOptions as LookupType)?.fk_lookup_column_id,
            )
            if (!nestedLookupCol) break

            finalTableMeta = nestedTableMeta
            finalColumn = nestedLookupCol
          }

          // Check if the final column is a LinkToAnotherRecord
          if (finalColumn?.uidt === UITypes.LinkToAnotherRecord) {
            const lookupColOpts = finalColumn.colOptions as LinkToAnotherRecordType
            const targetBaseId = lookupColOpts?.fk_related_base_id || (base.value?.id as string)
            const targetTableMeta = await getMeta(targetBaseId, lookupColOpts.fk_related_model_id as string)
            if (targetTableMeta) {
              finalTableMeta = targetTableMeta
              finalColumn = targetTableMeta.columns?.find((c) => c.pv) || targetTableMeta.columns?.[0]
            }
          }

          group.relatedTableMeta = finalTableMeta
          group.relatedColumn = finalColumn
          group.displayValueProp = finalColumn?.title
        }

        const index: number = response.list.indexOf(item)
        const value = valueToTitle(
          item[groupCol.column.title!] ?? item[groupCol.column.column_name!],
          groupCol.column,
          group?.displayValueProp,
        )
        const groupIndex = offset + index

        group = {
          ...group,
          groupIndex,
          column: groupCol.column,
          groups: new Map(),
          chunkStates: [],
          count: +item.count,
          groupCount: +item.__sub_group_count__,
          isExpanded: false,
          color: findKeyColor(value, groupCol.column, getNextColor),
          expandedGroups: 0,
          value,
          nestedIn: parentGroup
            ? [
                ...parentGroup.nestedIn,
                {
                  title: groupCol.column.title!,
                  column_name: groupCol.column.title!,
                  key: value,
                  column_uidt: group.relatedColumn?.uidt ?? groupCol.column.uidt,
                  column_id: groupCol.column.id,
                  groupIndex,
                },
              ]
            : [
                {
                  title: groupCol.column.title!,
                  column_name: groupCol.column.title!,
                  key: value,
                  column_uidt: group.relatedColumn?.uidt ?? groupCol.column.uidt,
                  column_id: groupCol.column.id,
                  groupIndex,
                },
              ],
          aggregations: {},
        }

        const groupPath = generateGroupPath(group)

        let routePath = (routeQuery.value?.path?.split('-') ?? []).map((c) => +c)

        routePath = [
          ...routePath.slice(0, group.nestedIn.length),
          ...Array(Math.max(0, group.nestedIn.length - routePath.length)).fill(''),
        ]

        const isExpanded = groupPath.join('-') === routePath.join('-')

        const nestedKey = group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_') || 'default'

        group.isExpanded = groupKeysManager.hasKey(base.value?.id, view.value.id!, nestedKey) || isExpanded

        // Create useInfiniteData for leaf groups
        if (level === groupByColumns.value.length - 1) {
          group.path = groupPath
        }

        if (parentGroup) {
          parentGroup.groups.set(groupIndex, group)
        } else {
          cachedGroups.value.set(groupIndex, group)
        }
        groups.push(group)
      }

      // Aggregations are NOT fetched here — they load lazily when a group becomes
      // visible in the viewport (see fetchMissingGroupAggregations), so scrolling
      // through group headers doesn't fan out expensive per-group aggregate queries.

      if (!parentGroup) {
        totalGroups.value = response.pageInfo.totalRows || totalGroups.value
        chunkStates.value[chunkId] = 'loaded'
      } else {
        targetChunkStates[chunkId] = 'loaded'
      }
    } catch (error) {
      console.error(`Error fetching group chunk at level ${level}:`, error)
      const nextCount = (chunkFailureCounts.get(chunkKey) ?? 0) + 1
      chunkFailureCounts.set(chunkKey, nextCount)
      targetChunkStates[chunkId] = nextCount >= CANVAS_MAX_CHUNK_FETCH_ATTEMPTS ? 'failed' : undefined
    }
  }

  function buildNestedWhere(group: CanvasGroup, existing = ''): string {
    // Use nestedIn array instead of traversing parents
    if (!group?.nestedIn?.length) return existing

    const sanitiseValue = (value: string) => {
      return `"${value}"` // .replace(/"/g, '\\"')}`
    }

    return group.nestedIn.reduce((acc, curr) => {
      if (curr.key === GROUP_BY_VARS.NULL) {
        acc += `${acc.length ? '~and' : '@'}(${curr.title},gb_null)`
      } else if (curr.column_uidt === UITypes.Checkbox) {
        acc += `${acc.length ? '~and' : '@'}(${curr.title},${curr.key === GROUP_BY_VARS.TRUE ? 'checked' : 'notchecked'})`
      } else if (
        [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(curr.column_uidt as UITypes)
      ) {
        acc += `${acc.length ? '~and' : '@'}(${curr.title},gb_eq,exactDate,${sanitiseValue(curr.key)})`
      } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(curr.column_uidt as UITypes)) {
        try {
          const value = JSON.parse(curr.key)
          acc += `${acc.length ? '~and' : '@'}(${curr.title},gb_eq,${sanitiseValue(
            (Array.isArray(value) ? value : [value]).map((v: any) => v.id).join(','),
          )})`
        } catch (e) {
          console.error(e)
        }
      } else {
        acc += `${acc.length ? '~and' : '@'}(${curr.title},gb_eq,${sanitiseValue(curr.key)})`
      }
      return acc
    }, existing)
  }

  function buildNestedFilterArr(group: CanvasGroup, existing: FilterType[] = []): FilterType[] {
    // Use nestedIn array instead of traversing parents
    if (!group?.nestedIn?.length) return existing

    return group.nestedIn.reduce((acc, curr) => {
      if (curr.key === GROUP_BY_VARS.NULL) {
        // acc += `${acc.length ? '~and' : '@'}(${curr.title},gb_null)`
        acc.push({
          fk_column_id: curr.column_id,
          comparison_op: 'gb_null',
        })
      } else if (curr.column_uidt === UITypes.Checkbox) {
        acc.push({
          fk_column_id: curr.column_id,
          comparison_op: curr.key === GROUP_BY_VARS.TRUE ? 'checked' : 'notchecked',
        })
      } else if (
        [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(curr.column_uidt as UITypes)
      ) {
        acc.push({
          fk_column_id: curr.column_id,
          comparison_op: 'gb_eq',
          comparison_sub_op: 'exactDate',
          value: curr.key,
        })
      } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(curr.column_uidt as UITypes)) {
        try {
          const value = JSON.parse(curr.key)

          acc.push({
            fk_column_id: curr.column_id,
            comparison_op: 'gb_eq',
            value: (Array.isArray(value) ? value : [value]).map((v: any) => v.id).join(','),
          })
        } catch (e) {
          console.error(e)
        }
      } else {
        acc.push({
          fk_column_id: curr.column_id,
          comparison_op: 'gb_eq',
          value: curr.key,
        })
      }
      return acc ?? []
    }, existing)
  }

  function findGroupLevel(group: CanvasGroup): number {
    return group.nestedIn?.length || 0
  }

  const fetchMissingGroupChunks = async (startIndex: number, endIndex: number, parentGroup?: CanvasGroup, force = false) => {
    const firstChunkId = getGroupChunkIndex(startIndex)
    const lastChunkId = getGroupChunkIndex(endIndex)

    const targetChunkStates = parentGroup ? parentGroup.chunkStates : chunkStates.value
    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !targetChunkStates[chunkId] || force,
    )

    await Promise.all(chunksToFetch.map((chunkId) => fetchGroupChunk(chunkId, parentGroup, force)))
    callbacks?.syncVisibleData()

    // if found empty chunk, remove all chunks after it and fetch all chunks again
    if (force) {
      let foundEmptyChunk = false
      for (let i = startIndex; i <= endIndex; i++) {
        const targetGroup = cachedGroups.value.get(i)
        if (targetGroup?.count === 0) {
          foundEmptyChunk = true
        }

        if (foundEmptyChunk) {
          cachedGroups.value.delete(i)
        }
      }
    }

    await Promise.all(chunksToFetch.map((chunkId) => fetchGroupChunk(chunkId, parentGroup, force)))
  }

  const clearGroupCache = (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => {
    if (startIndex === Number.NEGATIVE_INFINITY && endIndex === Number.POSITIVE_INFINITY) {
      cachedGroups.value = new Map()
      chunkStates.value = []
      // Reload-style full reset: any chunk we wipe must also have its failure
      // count reset, otherwise the canvas retry cap fires on the first
      // failure of the next fetch.
      chunkFailureCounts.clear()
      return
    }

    const targetGroups = parentGroup ? parentGroup.groups : cachedGroups.value
    if (targetGroups.size <= MAX_GROUP_CACHE_SIZE) return

    const safeStartIndex = Math.max(0, startIndex)
    const safeEndIndex = Math.min((parentGroup ? parentGroup.count : totalGroups.value) - 1, endIndex)
    const newGroups = new Map<number, CanvasGroup>()

    for (let i = safeStartIndex; i <= safeEndIndex; i++) {
      const group = targetGroups.get(i)
      if (group) newGroups.set(i, group)
    }

    // Drop failure counters for chunks we're about to reset so future
    // re-fetches start with a fresh CANVAS_MAX_CHUNK_FETCH_ATTEMPTS budget.
    const keptFirstChunk = getGroupChunkIndex(safeStartIndex)
    const keptLastChunk = getGroupChunkIndex(safeEndIndex)
    const keyPrefix = parentGroup ? `${generateGroupPath(parentGroup)}:` : 'root:'
    for (const key of chunkFailureCounts.keys()) {
      if (!key.startsWith(keyPrefix)) continue
      const chunkId = Number(key.slice(keyPrefix.length))
      if (Number.isNaN(chunkId)) continue
      if (chunkId < keptFirstChunk || chunkId > keptLastChunk) {
        chunkFailureCounts.delete(key)
      }
    }

    if (parentGroup) {
      parentGroup.groups = newGroups
      parentGroup.chunkStates = parentGroup.chunkStates.map((state, index) =>
        index >= getGroupChunkIndex(safeStartIndex) && index <= getGroupChunkIndex(safeEndIndex) ? state : undefined,
      )
    } else {
      cachedGroups.value = newGroups
      chunkStates.value = chunkStates.value.map((state, index) =>
        index >= getGroupChunkIndex(safeStartIndex) && index <= getGroupChunkIndex(safeEndIndex) ? state : undefined,
      )
    }
  }

  async function syncCount(group?: CanvasGroup, throwError = false, showToastMessage = false) {
    if (!view.value || !meta.value?.columns?.length) return

    try {
      if (!group) {
        const groupCol = groupByColumns.value?.[0]
        if (!groupCol) return

        const effectiveWhere = appendHideEmptyWhere(groupCol.column.title, where?.value)

        totalGroups.value = interfaceDataApi
          ? // no dedicated count op — the group-by op's `pageInfo.totalRows` is
            // the exact `groupByCount` result, so a limit-1 fetch doubles as one
            (
              await interfaceDataApi.fetchGroupBy({
                limit: 1,
                where: effectiveWhere,
                column_name: groupCol.column.title!,
                filtersArr: nestedFilters.value ?? [],
              })
            ).pageInfo.totalRows ?? 0
          : isPublic.value
          ? await $api.public.dataGroupByCount(
              sharedView.value!.uuid!,
              {
                where: effectiveWhere,
                column_name: groupCol.column.title,
                filterArrJson: JSON.stringify(nestedFilters.value),
              },
              {
                headers: {
                  'xc-password': sharedViewPassword.value,
                },
              },
            )
          : await $api.dbViewRow.groupByCount('noco', base.value.id!, view.value.fk_model_id, view.value.id!, {
              where: effectiveWhere,
              column_name: groupCol.column.title,
            })
      } else {
        const groupCol = groupByColumns.value?.[group.nestedIn.length]

        if (!groupCol) return

        const groupFilterArr = buildNestedFilterArr(group) ?? []
        const effectiveWhere = appendHideEmptyWhere(groupCol.column.title, where?.value)

        group.groupCount = interfaceDataApi
          ? (
              await interfaceDataApi.fetchGroupBy({
                limit: 1,
                where: effectiveWhere,
                column_name: groupCol.column.title!,
                filtersArr: nestedFilters.value ?? [],
                // nesting predicate — apart from `filtersArr` (Filter-action
                // gated); nesting always applies
                nestedFiltersArr: groupFilterArr,
              })
            ).pageInfo.totalRows ?? 0
          : isPublic.value
          ? await $api.public.dataGroupByCount(
              sharedView.value!.uuid!,
              {
                where: effectiveWhere,
                column_name: groupCol.column.title,
                filterArrJson: JSON.stringify([...(nestedFilters.value || []), ...groupFilterArr]),
              },
              {
                headers: {
                  'xc-password': sharedViewPassword.value,
                },
              },
            )
          : await $api.dbViewRow.groupByCount('noco', base.value.id!, view.value.fk_model_id, view.value.id!, {
              where: effectiveWhere,
              column_name: groupCol.column.title,
              filterArrJson: JSON.stringify(groupFilterArr),
            })
      }
    } catch (e: any) {
      // Interface page deleted mid-flight — see useInfiniteData.syncCount.
      const isStaleInterfacePage = !!interfaceDataApi && e?.response?.status === 404

      if (showToastMessage && !isStaleInterfacePage) {
        const errorMessage = await extractSdkResponseErrorMsg(e)
        message.error(`Failed to sync count: ${errorMessage}`)
      }

      if (throwError) {
        throw e
      }
    }
  }

  async function updateGroupAggregations(
    groups: CanvasGroup[],
    fields?: Array<{
      title: string
      aggregation?: string
    }>,
  ) {
    // Interface pages route through the adapter's bulk op when available.
    if (appInfo.value.disableGroupByAggregation || (interfaceDataApi && !interfaceDataApi.fetchBulkAggregate)) return

    const BATCH_SIZE = 100
    const aggregationAliasMapper = new AliasMapper()

    const aggregation = fields
      ? fields
          .map((f) => {
            const col = gridViewColByTitle.value[f.title]
            return col
              ? {
                  field: col.fk_column_id!,
                  type: f.aggregation ?? col.aggregation ?? CommonAggregations.None,
                }
              : null
          })
          .filter(Boolean)
      : Object.values(gridViewCols.value)
          .map((f) => ({
            field: f.fk_column_id!,
            type: f.aggregation ?? CommonAggregations.None,
          }))
          .filter((f) => f.type !== CommonAggregations.None)

    if (!aggregation.length) return

    // Only a full-set fetch (no explicit field subset) settles aggregationState —
    // a partial field refresh must not block the lazy full fetch for a group that
    // hasn't loaded its remaining aggregations yet.
    const markState = fields === undefined

    const fieldAggregationMap = new Map<string, string>()
    if (fields) {
      fields.forEach((f) => {
        const col = gridViewColByTitle.value[f.title]
        if (col?.fk_column_id) {
          fieldAggregationMap.set(col.fk_column_id, f.aggregation ?? col.aggregation ?? CommonAggregations.None)
        }
      })
    }

    for (let i = 0; i < groups.length; i += BATCH_SIZE) {
      const batchGroups = groups.slice(i, i + BATCH_SIZE)

      if (markState) {
        batchGroups.forEach((group) => {
          group.aggregationState = 'loading'
        })
      }

      const aggregationParams = batchGroups.map((group) => ({
        where: where?.value,
        alias: aggregationAliasMapper.generateAlias(createGroupUniqueIdentifier(group)),
        filterArrJson: JSON.stringify([...(nestedFilters.value || []), ...buildNestedFilterArr(group)]),
      }))

      try {
        const aggResponse = interfaceDataApi
          ? await interfaceDataApi.fetchBulkAggregate!({
              aggregation: aggregation as Array<{ field: string; type: string }>,
              where: where?.value,
              filtersArr: nestedFilters.value,
              bulkFilterList: aggregationParams,
            })
          : !isPublic.value
          ? await $api.internal.postOperation(
              (meta.value as any)!.fk_workspace_id!,
              meta.value!.base_id!,
              {
                operation: 'bulkAggregate',
                tableId: meta.value!.id,
                viewId: view.value!.id,
                baseId: meta.value!.base_id!,
                aggregation,
                filterArrJson: JSON.stringify(nestedFilters.value),
              },
              aggregationParams,
            )
          : await fetchBulkAggregatedData(
              {
                aggregation,
                filterArrJson: JSON.stringify(nestedFilters.value),
              },
              aggregationParams,
            )

        await aggregationAliasMapper.process(aggResponse, (originalKey, value) => {
          const group = batchGroups.find((g) => createGroupUniqueIdentifier(g) === originalKey.toString())

          if (!group) return

          Object.keys(value).forEach((key) => {
            const field = gridViewColByTitle.value[key]
            const col = columnsById.value[field.fk_column_id]
            const aggregationType = fieldAggregationMap.get(field.fk_column_id) ?? field.aggregation
            value[key] =
              getFormattedAggrationValue(aggregationType, value[key], col, [originalKey.toString()], {
                col,
                meta: meta.value as TableType,
                metas: metas.value,
                isMysql: baseStore.isMysql,
                isPg: baseStore.isPg,
              }) ?? ''
          })

          Object.assign(group.aggregations, value)
        })

        if (markState) {
          batchGroups.forEach((group) => {
            group.aggregationState = 'loaded'
            aggregationFailureCounts.delete(createGroupUniqueIdentifier(group))
          })
        }
      } catch (error) {
        console.error('Error refreshing group aggregations batch:', error)

        if (markState) {
          batchGroups.forEach((group) => {
            const key = createGroupUniqueIdentifier(group)
            const attempts = (aggregationFailureCounts.get(key) ?? 0) + 1

            if (attempts >= AGGREGATION_MAX_FETCH_ATTEMPTS) {
              // Give up — 'loaded' stops the viewport loop from re-requesting, which
              // also makes the counter unreachable, so drop it instead of leaking it.
              group.aggregationState = 'loaded'
              aggregationFailureCounts.delete(key)
            } else {
              aggregationFailureCounts.set(key, attempts)
              group.aggregationState = undefined
            }
          })
        }
      }
    }
    callbacks?.syncVisibleData()
  }

  /**
   * Viewport-lazy aggregation loader — called by the canvas render loop with the
   * groups currently visible. Debounced so a scroll pass coalesces into one
   * bulkAggregate request; groups already loading/loaded are skipped.
   */
  function fetchMissingGroupAggregations(groups: CanvasGroup[]) {
    if (appInfo.value.disableGroupByAggregation || (interfaceDataApi && !interfaceDataApi.fetchBulkAggregate)) return
    if (!hasAggregations.value) return

    for (const group of groups) {
      if (group.aggregationState) continue
      pendingAggregationGroups.set(createGroupUniqueIdentifier(group), group)
    }

    if (!pendingAggregationGroups.size || aggregationFlushTimer) return

    aggregationFlushTimer = setTimeout(() => {
      aggregationFlushTimer = null
      const groupsToFetch = [...pendingAggregationGroups.values()].filter((group) => !group.aggregationState)
      pendingAggregationGroups.clear()
      if (groupsToFetch.length) {
        updateGroupAggregations(groupsToFetch)
      }
    }, AGGREGATION_FETCH_DEBOUNCE_MS)
  }

  const toggleExpand = async (group: CanvasGroup) => {
    group.isExpanded = !group.isExpanded
    const nestedKey = group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_') || 'default'

    if (!view.value?.id) return
    groupKeysManager.toggleKey(base.value?.id, view.value.id, nestedKey, group.isExpanded)
  }

  const toggleExpandAll = async (path: number[], expand: boolean) => {
    let targetGroups: Map<number, CanvasGroup>
    if (!path?.length) {
      path = [0]
    }

    if (path.length === 1) {
      targetGroups = cachedGroups.value
    } else {
      let currentGroups = cachedGroups.value

      for (let i = 0; i < path.length - 1; i++) {
        const group = currentGroups.get(path[i])
        if (!group || !group.groups) return
        currentGroups = group.groups
      }

      targetGroups = currentGroups
    }

    if (!view.value?.id) return

    targetGroups.forEach((group) => {
      const nestedKey = group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_') || 'default'
      group.isExpanded = expand
      groupKeysManager.toggleKey(base.value?.id, view.value.id!, nestedKey, expand)
    })

    callbacks?.syncVisibleData()
  }

  const isGroupBy = computed(() => !!groupByColumns.value.length)

  return {
    isGroupBy,
    cachedGroups,
    groupByColumns,
    totalGroups,
    chunkStates,
    syncCount,
    fetchMissingGroupChunks,
    clearGroupCache,
    toggleExpand,
    GROUP_CHUNK_SIZE,
    buildNestedWhere,
    buildNestedFilterArr,
    CHUNK_SIZE: 50,
    columnsById,
    gridViewColByTitle,
    updateGroupAggregations,
    fetchMissingGroupAggregations,
    toggleExpandAll,
  }
}

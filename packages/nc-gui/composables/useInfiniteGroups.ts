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

  const groupByColumns = computed(() => {
    const tempGroupBy: { column: ColumnType; sort: string; order?: number }[] = []
    Object.values(gridViewCols.value).forEach((col) => {
      if (col.group_by) {
        const column = meta?.value?.columns?.find((f) => f.id === col.fk_column_id)
        if (column) {
          tempGroupBy.push({
            column,
            sort: col.group_by_sort || 'asc',
            order: col.group_by_order || 1,
          })
        }
      }
    })
    tempGroupBy.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    return tempGroupBy
  })

  const cachedGroups = ref<Map<number, CanvasGroup>>(new Map())
  const totalGroups = ref(0)
  const chunkStates = ref<Array<'loading' | 'loaded' | undefined>>([])

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

    if (targetChunkStates[chunkId] === 'loading' || (targetChunkStates[chunkId] === 'loaded' && !force)) return

    targetChunkStates[chunkId] = 'loading'
    const offset = chunkId * GROUP_CHUNK_SIZE
    const level = parentGroup ? findGroupLevel(parentGroup) : 0
    const groupCol = groupByColumns.value[level]

    if (!groupCol || !view.value?.id || !base.value?.id) return

    try {
      const nestedGrpWhereArr = buildNestedFilterArr(parentGroup) ?? []

      const response = isPublic.value
        ? await $api.public.dataGroupBy(
            sharedView.value!.uuid!,
            {
              offset,
              limit: GROUP_CHUNK_SIZE,
              where: where.value,
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
            where: where.value,
            sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
            column_name: groupCol.column.title,
            sortArrJson: JSON.stringify(sorts.value),
            filterArrJson: JSON.stringify([...(nestedFilters.value || []), ...nestedGrpWhereArr]),
            subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
          })

      const groups: CanvasGroup[] = []
      for (const item of response.list) {
        let group: CanvasGroup = {} as any

        if (groupCol.column.uidt === UITypes.LinkToAnotherRecord) {
          const relatedTableMeta = await getMeta(
            (groupCol.column.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
          )
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

          const relatedTableMeta = await getMeta(relationColumn.colOptions.fk_related_model_id as string)
          if (!relatedTableMeta) continue

          const lookupColumn = relatedTableMeta.columns?.find(
            (c) => c.id === (groupCol.column.colOptions as LookupType)?.fk_lookup_column_id,
          )
          if (!lookupColumn) continue

          let finalTableMeta = relatedTableMeta
          let finalColumn = lookupColumn

          // Check if the lookup column is a LinkToAnotherRecord
          if (lookupColumn.uidt === UITypes.LinkToAnotherRecord) {
            const targetTableMeta = await getMeta(
              (lookupColumn.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
            )
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
                  column_uidt: groupCol.column.uidt,
                  column_id: groupCol.column.id,
                  groupIndex,
                },
              ]
            : [
                {
                  title: groupCol.column.title!,
                  column_name: groupCol.column.title!,
                  key: value,
                  column_uidt: groupCol.column.uidt,
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

        group.isExpanded = groupKeysManager.hasKey(view.value.id!, nestedKey) || isExpanded

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

      if (appInfo.value?.ee && groups.length) {
        const aggregationAliasMapper = new AliasMapper()

        const aggregation = Object.values(gridViewCols.value)
          .map((f) => ({
            field: f.fk_column_id!,
            type: f.aggregation ?? CommonAggregations.None,
          }))
          .filter((f) => f.type !== CommonAggregations.None)

        const aggregationParams = groups.map((group) => ({
          where: where?.value,
          alias: aggregationAliasMapper.generateAlias(group.value),
          filterArrJson: JSON.stringify([...nestedFilters.value, ...buildNestedFilterArr(group)]),
        }))
        let aggResponse = {}

        if (aggregation.length) {
          aggResponse = !isPublic.value
            ? await $api.dbDataTableBulkAggregate.dbDataTableBulkAggregate(
                meta.value!.id,
                {
                  viewId: view.value!.id,
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
            const group = groups.find((g) => g.value.toString() === originalKey.toString())

            Object.keys(value).forEach((key) => {
              const field = gridViewColByTitle.value[key]
              const col = columnsById.value[field.fk_column_id]
              value[key] =
                getFormattedAggrationValue(field.aggregation, value[key], col, [originalKey.toString()], {
                  col,
                  meta: meta.value as TableType,
                  metas: metas.value,
                  isMysql: baseStore.isMysql,
                  isPg: baseStore.isPg,
                }) ?? ''
            })

            if (group) {
              Object.assign(group.aggregations, value)
            }
          })
        }
      }

      if (!parentGroup) {
        totalGroups.value = response.pageInfo.totalRows || totalGroups.value
        chunkStates.value[chunkId] = 'loaded'
      } else {
        targetChunkStates[chunkId] = 'loaded'
      }
    } catch (error) {
      console.error(`Error fetching group chunk at level ${level}:`, error)
      targetChunkStates[chunkId] = undefined
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

  async function syncCount(group?: CanvasGroup) {
    if (!view.value || !meta.value?.columns?.length) return

    if (!group) {
      const groupCol = groupByColumns.value?.[0]
      if (!groupCol) return

      totalGroups.value = isPublic.value
        ? await $api.public.dataGroupByCount(
            sharedView.value!.uuid!,
            {
              where: where?.value,
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
            where: where?.value,
            column_name: groupCol.column.title,
          })
    } else {
      const groupCol = groupByColumns.value?.[group.nestedIn.length]

      if (!groupCol) return

      const groupFilterArr = buildNestedFilterArr(group) ?? []

      group.groupCount = isPublic.value
        ? await $api.public.dataGroupByCount(
            sharedView.value!.uuid!,
            {
              where: where?.value,
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
            where: where?.value,
            column_name: groupCol.column.title,
            filterArrJson: JSON.stringify(groupFilterArr),
          })
    }
  }

  async function updateGroupAggregations(
    groups: CanvasGroup[],
    fields?: Array<{
      title: string
      aggregation?: string
    }>,
  ) {
    if (!appInfo.value?.ee) return

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

      const aggregationParams = batchGroups.map((group) => ({
        where: where?.value,
        alias: aggregationAliasMapper.generateAlias(createGroupUniqueIdentifier(group)),
        filterArrJson: JSON.stringify([...(nestedFilters.value || []), ...buildNestedFilterArr(group)]),
      }))

      try {
        const aggResponse = !isPublic.value
          ? await $api.dbDataTableBulkAggregate.dbDataTableBulkAggregate(
              meta.value!.id,
              {
                viewId: view.value!.id,
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
      } catch (error) {
        console.error('Error refreshing group aggregations batch:', error)
      }
    }
    callbacks?.syncVisibleData()
  }

  const toggleExpand = async (group: CanvasGroup) => {
    group.isExpanded = !group.isExpanded
    const nestedKey = group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_') || 'default'

    if (!view.value?.id) return
    groupKeysManager.toggleKey(view.value.id, nestedKey, group.isExpanded)
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
      groupKeysManager.toggleKey(view.value.id!, nestedKey, expand)
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
    toggleExpandAll,
  }
}

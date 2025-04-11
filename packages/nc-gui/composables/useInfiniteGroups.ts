import {
  type ColumnType,
  CommonAggregations,
  type LinkToAnotherRecordType,
  type TableType,
  UITypes,
  type ViewType,
} from 'nocodb-sdk'
import { generateGroupPath } from '../components/smartsheet/grid/canvas/utils/groupby'
import type { CanvasGroup } from '#imports'

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
  const { base } = storeToRefs(useBase())
  const { $api } = useNuxtApp()
  const { getMeta } = useMetas()
  const { appInfo } = useGlobal()
  const { nestedFilters, sorts } = useSmartsheetStoreOrThrow()
  const { fetchBulkAggregatedData, sharedView } = useSharedView()
  const isPublic = inject(IsPublicInj, ref(false))
  const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

  const activeGroupKeys = ref<Array<string>>([])

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
      const nestedWhere = parentGroup ? buildNestedWhere(parentGroup, where?.value) : where.value

      const response = isPublic.value
        ? await $api.public.dataGroupBy(
            sharedView.value!.uuid!,
            {
              offset,
              limit: GROUP_CHUNK_SIZE,
              where: nestedWhere,
              sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
              column_name: groupCol.column.title,
              subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
              sortArrJson: JSON.stringify(sorts.value),
              filterArrJson: JSON.stringify(nestedFilters.value),
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
            where: nestedWhere,
            sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
            column_name: groupCol.column.title,
            sortArrJson: JSON.stringify(sorts.value),
            filterArrJson: JSON.stringify(nestedFilters.value),
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
          groupCount: +item[groupByColumns.value?.[level + 1]?.column?.title],
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
                  groupIndex,
                },
              ]
            : [
                {
                  title: groupCol.column.title!,
                  column_name: groupCol.column.title!,
                  key: value,
                  column_uidt: groupCol.column.uidt,
                  groupIndex,
                },
              ],
          aggregations: {},
        }

        const nestedKey = group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_') || 'default'
        group.isExpanded = activeGroupKeys.value.includes(nestedKey)

        // Create useInfiniteData for leaf groups
        if (level === groupByColumns.value.length - 1) {
          group.path = generateGroupPath(group)
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
          where: buildNestedWhere(group, where?.value),
          alias: aggregationAliasMapper.generateAlias(group.value),
          filterArrJson: JSON.stringify(nestedFilters.value),
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
              value[key] = formatAggregation(field.aggregation, value[key], col) ?? ''
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

    return group.nestedIn.reduce((acc, curr) => {
      if (curr.key === GROUP_BY_VARS.NULL) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},gb_null)`
      } else if (curr.column_uidt === UITypes.Checkbox) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},${curr.key === GROUP_BY_VARS.TRUE ? 'checked' : 'notchecked'})`
      } else if (
        [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(curr.column_uidt as UITypes)
      ) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},gb_eq,exactDate,${curr.key})`
      } else if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(curr.column_uidt as UITypes)) {
        try {
          const value = JSON.parse(curr.key)
          acc += `${acc.length ? '~and' : ''}(${curr.title},gb_eq,${(Array.isArray(value) ? value : [value])
            .map((v: any) => v.id)
            .join(',')})`
        } catch (e) {
          console.error(e)
        }
      } else {
        acc += `${acc.length ? '~and' : ''}(${curr.title},gb_eq,${curr.key})`
      }
      return acc
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
        ? await $api.public.dataGroupByCount(sharedView.value!.uuid!, {
            where: where?.value,
            column_name: groupCol.column.title,
            filterArrJson: JSON.stringify(nestedFilters.value),
          })
        : await $api.dbViewRow.groupByCount('noco', base.value.id!, view.value.fk_model_id, view.value.id!, {
            where: where?.value,
            column_name: groupCol.column.title,
          })
    } else {
      const groupCol = groupByColumns.value?.[group.nestedIn.length]

      if (!groupCol) return

      const groupWhere = buildNestedWhere(group, where?.value)

      group.groupCount = isPublic.value
        ? await $api.public.dataGroupByCount(sharedView.value!.uuid!, {
            where: groupWhere,
            column_name: groupCol.column.title,
            filterArrJson: JSON.stringify(nestedFilters.value),
          })
        : await $api.dbViewRow.groupByCount('noco', base.value.id!, view.value.fk_model_id, view.value.id!, {
            where: groupWhere,
            column_name: groupCol.column.title,
          })
    }
  }

  async function updateGroupAggregations(groups: CanvasGroup[], fields?: Array<{ title: string; aggregation?: string }>) {
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
        where: buildNestedWhere(group, where?.value),
        alias: aggregationAliasMapper.generateAlias(group.value),
        filterArrJson: JSON.stringify(nestedFilters.value),
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
          const group = batchGroups.find((g) => g.value.toString() === originalKey.toString())

          if (!group) return

          Object.keys(value).forEach((key) => {
            const field = gridViewColByTitle.value[key]
            const col = columnsById.value[field.fk_column_id]
            const aggregationType = fieldAggregationMap.get(field.fk_column_id) ?? field.aggregation
            value[key] = formatAggregation(aggregationType, value[key], col) ?? ''
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

    if (group.isExpanded) {
      if (!activeGroupKeys.value.includes(nestedKey)) {
        activeGroupKeys.value.push(nestedKey)
      }
    } else {
      const index = activeGroupKeys.value.indexOf(nestedKey)
      if (index !== -1) {
        activeGroupKeys.value.splice(index, 1)
      }
    }
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
    CHUNK_SIZE: 50,
    columnsById,
    gridViewColByTitle,
    updateGroupAggregations,
  }
}

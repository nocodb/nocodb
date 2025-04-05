import { type ColumnType, type LinkToAnotherRecordType, type TableType, UITypes, type ViewType } from 'nocodb-sdk'
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

  const fetchGroupChunk = async (chunkId: number, parentGroup?: CanvasGroup) => {
    const targetChunkStates = parentGroup ? parentGroup.chunkStates : chunkStates.value
    if (targetChunkStates[chunkId] === 'loading' || targetChunkStates[chunkId] === 'loaded') return

    targetChunkStates[chunkId] = 'loading'
    const offset = chunkId * GROUP_CHUNK_SIZE
    const level = parentGroup ? findGroupLevel(parentGroup) : 0
    const groupCol = groupByColumns.value[level]

    if (!groupCol || !view.value?.id || !base.value?.id) return

    try {
      const nestedWhere = parentGroup ? buildNestedWhere(parentGroup, where?.value) : ''

      // TODO: @DarkPhoenix2704 - Add Public Endpoint here
      const response = await $api.dbViewRow.groupBy('noco', base.value.id, view.value.fk_model_id, view.value.id, {
        offset,
        limit: GROUP_CHUNK_SIZE,
        where: nestedWhere,
        sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
        column_name: groupCol.column.title,
        subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
      })

      for (const item of response.list) {
        const index: number = response.list.indexOf(item)
        const value = valueToTitle(item[groupCol.column.title!], groupCol.column)
        const groupIndex = offset + index

        const group: CanvasGroup = {
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
        }

        if (group.column.uidt === UITypes.LinkToAnotherRecord) {
          const relatedTableMeta = await getMeta(
            (group.column.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
          )
          if (!relatedTableMeta) continue
          group.relatedTableMeta = relatedTableMeta
          const col = relatedTableMeta.columns?.find((c) => c.pv) || relatedTableMeta.columns?.[0]
          group.relatedColumn = col
          group.displayValueProp = col?.title
        }

        // Create useInfiniteData for leaf groups
        if (level === groupByColumns.value.length - 1) {
          group.path = generateGroupPath(group)
        }

        if (parentGroup) {
          parentGroup.groups.set(groupIndex, group)
        } else {
          cachedGroups.value.set(groupIndex, group)
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

  const fetchMissingGroupChunks = async (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => {
    const firstChunkId = getGroupChunkIndex(startIndex)
    const lastChunkId = getGroupChunkIndex(endIndex)

    const targetChunkStates = parentGroup ? parentGroup.chunkStates : chunkStates.value
    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !targetChunkStates[chunkId],
    )

    await Promise.all(chunksToFetch.map((chunkId) => fetchGroupChunk(chunkId, parentGroup)))
    callbacks?.syncVisibleData()
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

      totalGroups.value = await $api.dbViewRow.groupByCount('noco', base.value.id!, view.value.fk_model_id, view.value.id!, {
        where: where?.value,
        sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any[],
        column_name: groupCol.column.title,
      })
    }
    callbacks?.syncVisibleData()
  }

  const toggleExpand = async (group: CanvasGroup) => {
    group.isExpanded = !group.isExpanded
    callbacks?.syncVisibleData()
  }

  watch(groupByColumns, () => {
    clearGroupCache(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)
    callbacks?.syncVisibleData()
  })

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
  }
}

import { type ColumnType, type LinkToAnotherRecordType, type TableType, UITypes, type ViewType } from 'nocodb-sdk'
import type { CanvasGroup } from '../../../../../lib/types'

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
  where?: ComputedRef<string | undefined>,
) => {
  const { gridViewCols } = useViewColumnsOrThrow()
  const { base } = storeToRefs(useBase())
  const { $api } = useNuxtApp()
  const { getMeta } = useMetas()

  const isPublic = inject(IsPublicInj, ref(false))

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
    const level = parentGroup ? findGroupLevel(parentGroup) + 1 : 0
    const groupCol = groupByColumns.value[level]

    if (!groupCol || !view.value?.id || !base.value?.id) return

    try {
      const whereClause = parentGroup
        ? `${where?.value ? `${where.value}~and` : ''}(${parentGroup.column.title},gb_eq,${parentGroup.value})`
        : where?.value

      const response = await $api.dbViewRow.groupBy('noco', base.value.id, view.value.fk_model_id, view.value.id, {
        offset,
        limit: GROUP_CHUNK_SIZE,
        where: whereClause,
        sort: `${getSortParams(groupCol.sort)}${groupCol.column.title}` as any,
        column_name: groupCol.column.title,
        subGroupColumnName: groupByColumns.value[level + 1]?.column.title,
      })

      for (const item of response.list) {
        const index: number = response.list.indexOf(item)
        const value = valueToTitle(item[groupCol.column.title!], groupCol.column)
        const group: CanvasGroup = {
          column: groupCol.column,
          groups: new Map(),
          chunkStates: [],
          count: +item.count,
          groupCount: +item[groupByColumns.value?.[level + 1]?.column?.title],
          isExpanded: false,
          color: findKeyColor(value, groupCol.column, getNextColor),
          expandedGroups: 0,
          value,
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
          group.infiniteData = useInfiniteData({
            meta,
            viewMeta: view,
            where: computed(() => buildNestedWhere(group, where?.value)),
            callbacks: {},
            isPublic,
          })
        }

        const groupIndex = offset + index
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
    let current: CanvasGroup | undefined = group
    const conditions: string[] = []

    while (current) {
      if (current.value !== null) {
        conditions.push(`(${current.column.title},gb_eq,${current.value})`)
      } else {
        conditions.push(`(${current.column.title},gb_null)`)
      }
      current = findParentGroup(current)
    }

    return conditions.length ? `${existing ? `${existing}~and` : ''}${conditions.join('~and')}` : existing
  }

  function findParentGroup(group: CanvasGroup): CanvasGroup | undefined {
    for (const [_, parent] of cachedGroups.value) {
      if (parent.groups.has([...parent.groups.values()].findIndex((g) => g === group))) return parent
      for (const [_, child] of parent.groups) {
        if (child.groups.has([...child.groups.values()].findIndex((g) => g === group))) return child
      }
    }
  }

  function findGroupLevel(group: CanvasGroup): number {
    let level = 0
    let current: CanvasGroup | undefined = group
    while (current) {
      current = findParentGroup(current)
      level++
    }
    return level - 1
  }

  const fetchMissingGroupChunks = async (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => {
    const firstChunkId = getGroupChunkIndex(startIndex)
    const lastChunkId = getGroupChunkIndex(endIndex)

    const targetChunkStates = parentGroup ? parentGroup.chunkStates : chunkStates.value
    const chunksToFetch = Array.from({ length: lastChunkId - firstChunkId + 1 }, (_, i) => firstChunkId + i).filter(
      (chunkId) => !targetChunkStates[chunkId],
    )

    await Promise.all(chunksToFetch.map((chunkId) => fetchGroupChunk(chunkId, parentGroup)))
  }

  const fetchMissingRowChunks = async (group: CanvasGroup, startIndex: number, endIndex: number) => {
    if (!group.infiniteData) return
    await group.infiniteData.fetchMissingChunks(startIndex, endIndex)
    group.infiniteData.clearCache(startIndex, endIndex)
  }

  const clearGroupCache = (startIndex: number, endIndex: number, parentGroup?: CanvasGroup) => {
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
    } else if (group.infiniteData) {
      await group.infiniteData.syncCount()
      group.count = group.infiniteData.totalRows.value
    }
  }

  const toggleExpand = async (group: CanvasGroup, startIndex = 0, endIndex = GROUP_CHUNK_SIZE - 1) => {
    group.isExpanded = !group.isExpanded
    if (group.isExpanded) {
      const level = findGroupLevel(group)
      if (level < groupByColumns.value.length - 1) {
        await fetchMissingGroupChunks(startIndex, endIndex, group)
      } else if (group.infiniteData) {
        await fetchMissingRowChunks(group, startIndex, endIndex)
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
    fetchMissingRowChunks,
    clearGroupCache,
    toggleExpand,
    GROUP_CHUNK_SIZE,
    CHUNK_SIZE: 50,
  }
}

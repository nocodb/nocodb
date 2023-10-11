import { type ColumnType, type SelectOptionsType, UITypes, type ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { GROUP_BY_VARS, ref, storeToRefs, useApi, useBase, useViewColumnsOrThrow } from '#imports'
import type { Group, GroupNestedIn, Row } from '#imports'

export const useViewGroupBy = (view: Ref<ViewType | undefined>, where?: ComputedRef<string | undefined>) => {
  const { api } = useApi()

  const { base } = storeToRefs(useBase())

  const { sharedView, fetchSharedViewData } = useSharedView()

  const meta = inject(MetaInj)

  const { gridViewCols } = useViewColumnsOrThrow()

  const groupBy = computed<{ column: ColumnType; sort: string; order?: number }[]>(() => {
    const tempGroupBy: { column: ColumnType; sort: string; order?: number }[] = []
    Object.values(gridViewCols.value).forEach((col) => {
      if (col.group_by) {
        const column = meta?.value.columns?.find((f) => f.id === col.fk_column_id)
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

  const isGroupBy = computed(() => !!groupBy.value.length)

  const { isUIAllowed } = useRoles()

  const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

  const isPublic = inject(IsPublicInj, ref(false))

  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

  const groupByLimit = 10

  const rootGroup = ref<Group>({
    key: 'root',
    color: 'root',
    count: 0,
    column: {} as any,
    nestedIn: [],
    paginationData: { page: 1, pageSize: groupByLimit },
    nested: true,
    children: [],
    root: true,
  })

  async function groupWrapperChangePage(page: number, groupWrapper?: Group) {
    groupWrapper = groupWrapper || rootGroup.value

    if (!groupWrapper) return

    groupWrapper.paginationData.page = page
    await loadGroups(
      {
        offset: (page - 1) * (groupWrapper.paginationData.pageSize || groupByLimit),
      } as any,
      groupWrapper,
    )
  }

  const formatData = (list: Record<string, any>[]) =>
    list.map((row) => ({
      row: { ...row },
      oldRow: { ...row },
      rowMeta: {},
    }))

  const valueToTitle = (value: string, col: ColumnType) => {
    if (col.uidt === UITypes.Checkbox) {
      return value ? GROUP_BY_VARS.TRUE : GROUP_BY_VARS.FALSE
    }
    return value ?? GROUP_BY_VARS.NULL
  }

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

  const findKeyColor = (key?: string, col?: ColumnType): string => {
    if (col) {
      switch (col.uidt) {
        case UITypes.MultiSelect: {
          const keys = key?.split(',') || []
          const colors = []
          for (const k of keys) {
            const option = (col.colOptions as SelectOptionsType).options?.find((o) => o.title === k)
            if (option) {
              colors.push(option.color)
            }
          }
          return colors.join(',')
        }
        case UITypes.SingleSelect: {
          const option = (col.colOptions as SelectOptionsType).options?.find((o) => o.title === key)
          if (option) {
            return option.color || getNextColor()
          }
          return 'gray'
        }
        case UITypes.Checkbox: {
          if (key) {
            return themeColors.success
          }
          return themeColors.error
        }
        default:
          return key ? getNextColor() : 'gray'
      }
    }
    return key ? getNextColor() : 'gray'
  }

  const calculateNestedWhere = (nestedIn: GroupNestedIn[], existing = '') => {
    return nestedIn.reduce((acc, curr) => {
      if (curr.key === GROUP_BY_VARS.NULL) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},blank)`
      } else if (curr.column_uidt === UITypes.Checkbox) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},${curr.key === GROUP_BY_VARS.TRUE ? 'checked' : 'notchecked'})`
      } else if ([UITypes.Date, UITypes.DateTime].includes(curr.column_uidt as UITypes)) {
        acc += `${acc.length ? '~and' : ''}(${curr.title},eq,exactDate,${curr.key})`
      } else {
        acc += `${acc.length ? '~and' : ''}(${curr.title},eq,${curr.key})`
      }
      return acc
    }, existing)
  }

  async function loadGroups(params: any = {}, group?: Group) {
    group = group || rootGroup.value

    if (!base?.value?.id || !view.value?.id || !view.value?.fk_model_id || !group) return

    if (groupBy.value.length === 0) {
      group.children = []
      return
    }

    if (group.nestedIn.length > groupBy.value.length) return

    if (group.nestedIn.length === 0) nextGroupColor.value = colors.value[0]
    const groupby = groupBy.value[group.nestedIn.length]

    const nestedWhere = calculateNestedWhere(group.nestedIn, where?.value)
    if (!groupby || !groupby.column.title) return

    if (isPublic.value && !sharedView.value?.uuid) {
      return
    }

    const response = !isPublic.value
      ? await api.dbViewRow.groupBy('noco', base.value.id, view.value.fk_model_id, view.value.id, {
          offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? groupByLimit),
          limit: group.paginationData.pageSize ?? groupByLimit,
          ...params,
          ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          where: `${nestedWhere}`,
          sort: `${groupby.sort === 'desc' ? '-' : ''}${groupby.column.title}`,
          column_name: groupby.column.title,
        } as any)
      : await api.public.dataGroupBy(sharedView.value!.uuid!, {
          offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? groupByLimit),
          limit: group.paginationData.pageSize ?? groupByLimit,
          ...params,
          where: nestedWhere,
          sort: `${groupby.sort === 'desc' ? '-' : ''}${groupby.column.title}`,
          column_name: groupby.column.title,
          sortsArr: sorts.value,
          filtersArr: nestedFilters.value,
        })

    const tempList: Group[] = response.list.reduce((acc: Group[], curr: Record<string, any>) => {
      const keyExists = acc.find(
        (a) => a.key === valueToTitle(curr[groupby.column.column_name!] ?? curr[groupby.column.title!], groupby.column),
      )
      if (keyExists) {
        keyExists.count += +curr.count
        keyExists.paginationData = { page: 1, pageSize: groupByLimit, totalRows: keyExists.count }
        return acc
      }
      if (groupby.column.title && groupby.column.uidt) {
        acc.push({
          key: valueToTitle(curr[groupby.column.title!], groupby.column),
          column: groupby.column,
          count: +curr.count,
          color: findKeyColor(curr[groupby.column.title!], groupby.column),
          nestedIn: [
            ...group!.nestedIn,
            {
              title: groupby.column.title,
              column_name: groupby.column.title!,
              key: valueToTitle(curr[groupby.column.title!], groupby.column),
              column_uidt: groupby.column.uidt,
            },
          ],
          paginationData: { page: 1, pageSize: groupByLimit, totalRows: +curr.count },
          nested: group!.nestedIn.length < groupBy.value.length - 1,
        })
      }
      return acc
    }, [])

    if (!group.children) group.children = []

    for (const temp of tempList) {
      const keyExists = group.children?.find((a) => a.key === temp.key)
      if (keyExists) {
        temp.paginationData = {
          page: keyExists.paginationData.page || temp.paginationData.page,
          pageSize: keyExists.paginationData.pageSize || temp.paginationData.pageSize,
          totalRows: temp.count,
        }
        temp.color = keyExists.color
        // update group
        Object.assign(keyExists, temp)
        continue
      }
      group.children.push(temp)
    }

    // clear rest of the children
    group.children = group.children.filter((c) => tempList.find((t) => t.key === c.key))

    if (group.count <= (group.paginationData.pageSize ?? groupByLimit)) {
      group.children.sort((a, b) => {
        const orderA = tempList.findIndex((t) => t.key === a.key)
        const orderB = tempList.findIndex((t) => t.key === b.key)
        return orderA - orderB
      })
    }

    group.paginationData = response.pageInfo

    // to cater the case like when querying with a non-zero offset
    // the result page may point to the target page where the actual returned data don't display on
    const expectedPage = Math.max(1, Math.ceil(group.paginationData.totalRows! / group.paginationData.pageSize!))
    if (expectedPage < group.paginationData.page!) {
      await groupWrapperChangePage(expectedPage, group)
    }
  }

  async function loadGroupData(group: Group, force = false) {
    if (!base?.value?.id || !view.value?.id || !view.value?.fk_model_id) return

    if (group.children && !force) return

    if (!group.paginationData) {
      group.paginationData = { page: 1, pageSize: groupByLimit }
    }

    const nestedWhere = calculateNestedWhere(group.nestedIn, where?.value)

    const query = {
      offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? groupByLimit),
      limit: group.paginationData.pageSize ?? groupByLimit,
      where: `${nestedWhere}`,
    }

    const response = !isPublic.value
      ? await api.dbViewRow.list('noco', base.value.id, view.value.fk_model_id, view.value.id, {
          ...query,
          ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
          ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
        } as any)
      : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value, ...query })

    group.count = response.pageInfo.totalRows ?? 0
    group.rows = formatData(response.list)
    group.paginationData = response.pageInfo
  }

  const loadGroupPage = async (group: Group, p: number) => {
    if (!group.paginationData) {
      group.paginationData = { page: 1, pageSize: groupByLimit }
    }
    group.paginationData.page = p
    await loadGroupData(group, true)
  }

  const refreshNested = (group?: Group, nestLevel = 0) => {
    group = group || rootGroup.value
    if (!group) return

    if (nestLevel < groupBy.value.length) {
      group.nested = true
    } else {
      group.nested = false
    }

    if (group.nested) {
      if (group?.rows) {
        group.rows = []
      }
    } else {
      if (group?.children) {
        group.children = []
      }
    }

    if (nestLevel > groupBy.value.length) return

    for (const child of group.children || []) {
      refreshNested(child, nestLevel + 1)
    }
  }

  watch(
    () => groupBy.value.length,
    async () => {
      if (groupBy.value.length > 0) {
        rootGroup.value.paginationData = { page: 1, pageSize: groupByLimit }
        rootGroup.value.column = {} as any
        await loadGroups()
        refreshNested()
        nextTick(() => reloadViewDataHook?.trigger())
      }
    },
    { immediate: true },
  )

  const findGroupByNestedIn = (nestedIn: GroupNestedIn[], group?: Group, nestLevel = 0): Group => {
    group = group || rootGroup.value
    if (nestLevel >= nestedIn.length) return group
    const child = group.children?.find((g) => g.key === nestedIn[nestLevel].key)
    if (child) {
      if (child.nested) {
        return findGroupByNestedIn(nestedIn, child, nestLevel + 1)
      }
      return child
    }
    return group
  }

  const parentGroup = (group: Group) => {
    const parent = findGroupByNestedIn(group.nestedIn.slice(0, -1))
    return parent
  }

  const modifyCount = (group: Group, countEffect: number) => {
    if (!group) return
    group.count += countEffect
    // remove group if count is 0
    if (group.count === 0) {
      const parent = parentGroup(group)
      if (parent) {
        parent.children = parent.children?.filter((c) => c.key !== group.key)
      }
    }
    if (group.root) return
    modifyCount(parentGroup(group), countEffect)
  }

  const findGroupForRow = (row: Row, group?: Group, nestLevel = 0): { found: boolean; group: Group } => {
    group = group || rootGroup.value
    if (group.nested) {
      const child = group.children?.find((g) => {
        if (!groupBy.value[nestLevel].column.title) return undefined
        return g.key === valueToTitle(row.row[groupBy.value[nestLevel].column.title!], groupBy.value[nestLevel].column)
      })
      if (child) {
        return findGroupForRow(row, child, nestLevel + 1)
      }
      return { found: false, group }
    }
    return { found: true, group }
  }

  const redistributeRows = (group?: Group) => {
    group = group || rootGroup.value
    if (!group) return
    if (!group.nested && group.rows) {
      group.rows.forEach((row) => {
        const properGroup = findGroupForRow(row)
        if (properGroup.found) {
          if (properGroup.group !== group) {
            if (properGroup.group) {
              properGroup.group.rows?.push(row)
              modifyCount(properGroup.group, 1)
            }
            if (group) {
              group.rows?.splice(group!.rows.indexOf(row), 1)
              modifyCount(group, -1)
            }
          }
        } else {
          if (group) {
            group.rows?.splice(group!.rows.indexOf(row), 1)
            modifyCount(group, -1)
          }
          if (properGroup.group?.children) loadGroups({}, properGroup.group)
        }
      })
    } else {
      group.children?.forEach((g) => redistributeRows(g))
    }
  }

  return { rootGroup, groupBy, isGroupBy, loadGroups, loadGroupData, loadGroupPage, groupWrapperChangePage, redistributeRows }
}

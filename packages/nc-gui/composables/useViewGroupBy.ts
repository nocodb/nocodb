import { type ColumnType, type SelectOptionsType, UITypes, type ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ref, storeToRefs, useApi, useProject } from '#imports'
import type { Group, Row } from '~/lib'

export const useViewGroupBy = createSharedComposable(
  (view: Ref<ViewType | undefined>, where?: ComputedRef<string | undefined>, _reloadData?: () => void) => {
    const { api } = useApi()

    const { project } = storeToRefs(useProject())

    const groupBy = ref<any[]>([])

    const isGroupBy = computed(() => !!groupBy.value.length)

    const { appInfo } = $(useGlobal())

    const { isUIAllowed } = useUIPermission()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const appInfoDefaultLimit = appInfo.defaultLimit || 25

    const rootGroup = ref<Group>({
      key: 'root',
      color: 'root',
      count: 0,
      column: groupBy.value[0],
      nestedIn: [],
      paginationData: { page: 1, pageSize: appInfoDefaultLimit },
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
          offset: (page - 1) * (groupWrapper.paginationData.pageSize || appInfoDefaultLimit),
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

    const colors = $ref(enumColor.light)

    const nextGroupColor = ref(colors[0])

    const getNextColor = () => {
      const tempColor = nextGroupColor.value
      const index = colors.indexOf(nextGroupColor.value)
      if (index === colors.length - 1) {
        nextGroupColor.value = colors[0]
      } else {
        nextGroupColor.value = colors[index + 1]
      }
      return tempColor
    }

    const findKeyColor = (key: string, col: ColumnType) => {
      switch (col.uidt) {
        case UITypes.MultiSelect: {
          const keys = key.split(',')
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
            return option.color
          }
          return getNextColor()
        }
        default:
          return getNextColor()
      }
    }

    const calculateNestedWhere = (nestedIn: { title: string; column_name: string; value: string; column_uidt: string }[]) => {
      return nestedIn.reduce((acc, curr) => {
        if (curr.value === '__nc_null__') {
          acc += `~and(${curr.column_name},is,null)`
        } else if ([UITypes.Date, UITypes.DateTime].includes(curr.column_uidt as UITypes)) {
          acc += `~and(${curr.column_name},eq,${curr.value},exactDate)`
        } else {
          acc += `~and(${curr.column_name},eq,${curr.value})`
        }
        return acc
      }, '')
    }

    async function loadGroups(params: any = {}, group?: Group) {
      group = group || rootGroup.value

      if (!project?.value?.id || !view.value?.id || !view.value?.fk_model_id || !group) return

      if (groupBy.value.length === 0) {
        group.children = []
        return
      }

      if (group.nestedIn.length > groupBy.value.length) return

      if (group.nestedIn.length === 0) nextGroupColor.value = colors[0]

      const groupby = groupBy.value[group.nestedIn.length]

      const nestedWhere = calculateNestedWhere(group.nestedIn)

      if (!groupby || !groupby?.column_name) return

      const response = await api.dbViewRow.groupBy('noco', project.value.id, view.value.fk_model_id, view.value.id, {
        offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? appInfoDefaultLimit),
        limit: group.paginationData.pageSize ?? appInfoDefaultLimit,
        ...params,
        ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
        ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
        where: `${where?.value}${nestedWhere}`,
        sort: `${params.sort?.value === 'desc' ? '-' : ''}${groupby.column_name}`,
        column_name: groupby.column_name,
      } as any)

      group.children = response.list.reduce((acc: Group[], curr: any) => {
        acc.push({
          key: curr[groupby.column_name!] || '__nc_null__',
          column: groupby,
          count: curr.count,
          color: curr[groupby.column_name!] ? findKeyColor(curr[groupby.column_name!], groupby) : 'gray',
          nestedIn: [
            ...group!.nestedIn,
            {
              title: groupby.title,
              column_name: groupby.column_name!,
              value: curr[groupby.column_name!] || '__nc_null__',
              column_uidt: groupby.uidt,
            },
          ],
          paginationData: { page: 1, pageSize: appInfoDefaultLimit, totalRows: curr.count },
          nested: group!.nestedIn.length < groupBy.value.length - 1,
        })
        return acc
      }, [])

      group.paginationData = response.pageInfo

      // to cater the case like when querying with a non-zero offset
      // the result page may point to the target page where the actual returned data don't display on
      const expectedPage = Math.max(1, Math.ceil(group.paginationData.totalRows! / group.paginationData.pageSize!))
      if (expectedPage < group.paginationData.page!) {
        await groupWrapperChangePage(expectedPage, group)
      }
    }

    async function loadGroupData(group: Group, force = false) {
      if (!project?.value?.id || !view.value?.id || !view.value?.fk_model_id) return

      if (group.children && !force) return

      if (!group.paginationData) {
        group.paginationData = { page: 1, pageSize: appInfoDefaultLimit }
      }

      const nestedWhere = calculateNestedWhere(group.nestedIn)

      const query = {
        offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? appInfoDefaultLimit),
        limit: group.paginationData.pageSize ?? appInfoDefaultLimit,
        where: `${where?.value ?? ''}${nestedWhere}~and${
          group.key === '__nc_null__'
            ? `(${group.column.column_name},is,null)`
            : `(${group.column.column_name},eq${
                [UITypes.Date, UITypes.DateTime].includes(group.column.uidt as UITypes) ? ',exactDate' : ''
              },${group.key})`
        }`,
      }

      const response = await api.dbViewRow.list('noco', project.value.id, view.value.fk_model_id, view.value.id, {
        ...query,
        ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
        ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
      } as any)

      group.rows = formatData(response.list)
      group.paginationData = response.pageInfo
    }

    const loadGroupPage = async (group: Group, p: number) => {
      if (!group.paginationData) {
        group.paginationData = { page: 1, pageSize: appInfoDefaultLimit }
      }
      group.paginationData.page = p
      await loadGroupData(group, true)
    }

    watch(
      () => groupBy.value.length,
      () => {
        rootGroup.value = {
          key: 'root',
          color: 'root',
          count: 0,
          column: groupBy.value[0],
          nestedIn: [],
          paginationData: { page: 1, pageSize: appInfoDefaultLimit },
          nested: true,
          children: [],
          root: true,
        }
        loadGroups()
      },
    )

    const findGroupForRow = (row: Row, group?: Group, nestLevel = 0): { found: boolean; group: Group } => {
      group = group || rootGroup.value
      if (group.nested) {
        const child = group.children?.find((g) => g.key === (row.row[groupBy.value[nestLevel].column_name] ?? '__nc_null__'))
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
              properGroup.group.rows?.push(row)
              group?.rows?.splice(group!.rows.indexOf(row), 1)
            }
          } else {
            group?.rows?.splice(group!.rows.indexOf(row), 1)
            if (properGroup.group?.children) loadGroups({}, properGroup.group)
          }
        })
      } else {
        group.children?.forEach((g) => redistributeRows(g))
      }
    }

    return { rootGroup, groupBy, isGroupBy, loadGroups, loadGroupData, loadGroupPage, groupWrapperChangePage, redistributeRows }
  },
)

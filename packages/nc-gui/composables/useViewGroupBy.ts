import {
  type ColumnType,
  CommonAggregations,
  type LinkToAnotherRecordType,
  type LookupType,
  type SelectOptionsType,
  type TableType,
  type ViewType,
} from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { message } from 'ant-design-vue'
import type { Group } from '../lib/types'

const excludedGroupingUidt = [UITypes.Attachment, UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const [useProvideViewGroupBy, useViewGroupBy] = useInjectionState(
  (
    view: Ref<ViewType | undefined>,
    meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    where?: ComputedRef<string | undefined>,
    isPublic = false,
  ) => {
    const groupByLimit = 3

    const { api } = useApi()

    const { appInfo } = useGlobal()

    const { base } = storeToRefs(useBase())

    const { sharedView, fetchSharedViewData, fetchBulkAggregatedData } = useSharedView()

    const { gridViewCols } = useViewColumnsOrThrow()

    const { getMeta } = useMetas()

    const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

    const groupBy = computed<{ column: ColumnType; sort: string; order?: number }[]>(() => {
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

    const isGroupBy = computed(() => !!groupBy.value.length)

    const { isUIAllowed } = useRoles()

    const { sorts, nestedFilters } = useSmartsheetStoreOrThrow()

    const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

    const groupByGroupLimit = computed(() => {
      return appInfo.value.defaultGroupByLimit?.limitGroup || 25
    })

    const groupByRecordLimit = computed(() => {
      return appInfo.value.defaultGroupByLimit?.limitRecord || 10
    })

    const supportedLookups = ref<string[]>([])

    const fieldsToGroupBy = computed(() =>
      (meta?.value?.columns || []).filter((field) => {
        if (excludedGroupingUidt.includes(field.uidt as UITypes)) return false

        if (field.uidt === UITypes.Lookup) {
          return field.id && supportedLookups.value.includes(field.id)
        }

        return true
      }),
    )

    const rootGroup = ref<Group>({
      key: 'root',
      color: 'root',
      count: 0,
      column: {} as any,
      nestedIn: [],
      aggregations: {},
      paginationData: { page: 1, pageSize: groupByGroupLimit.value },
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
          offset: (page - 1) * (groupWrapper.paginationData.pageSize || groupByGroupLimit.value),
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

    const valueToTitle = (value: string, col: ColumnType, displayValueProp?: string) => {
      if (col.uidt === UITypes.Checkbox) {
        return value ? GROUP_BY_VARS.TRUE : GROUP_BY_VARS.FALSE
      }

      if ([UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt as UITypes)) {
        if (!value) {
          return GROUP_BY_VARS.NULL
        }
      }

      if (col.uidt === UITypes.LinkToAnotherRecord && displayValueProp && value && typeof value === 'object') {
        return value[displayValueProp] ?? GROUP_BY_VARS.NULL
      }

      // convert to JSON string if non-string value
      if (value && typeof value === 'object') {
        value = JSON.stringify(value)
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

    const getSortParams = (sort: string) => {
      if (sort === 'asc') {
        return '+'
      } else if (sort === 'desc') {
        return '-'
      } else if (sort === 'count-asc') {
        return '~+'
      } else if (sort === 'count-desc') {
        return '~-'
      }
    }

    const processGroupData = async (response: any, group?: Group) => {
      group = group || rootGroup.value

      const groupby = groupBy.value[group.nestedIn.length]

      if (!groupby) return group

      const tempList: Group[] = response.list.reduce((acc: Group[], curr: Record<string, any>) => {
        const keyExists = acc.find(
          (a) => a.key === valueToTitle(curr[groupby.column.column_name!] ?? curr[groupby.column.title!], groupby.column),
        )
        if (keyExists) {
          keyExists.count += +curr.count
          keyExists.paginationData = {
            page: 1,
            pageSize: group.paginationData.pageSize || groupByGroupLimit.value,
            totalRows: keyExists.count,
          }
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
            aggregations: curr.aggregations ?? {},
            paginationData: {
              page: 1,
              pageSize:
                group!.nestedIn.length < groupBy.value.length - 1
                  ? group.paginationData.pageSize || groupByGroupLimit.value
                  : groupByRecordLimit.value,
              totalRows: +curr.count,
            },
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

      group.children = group.children.filter((c) => tempList.find((t) => t.key === c.key))

      if (group.count <= (group.paginationData.pageSize ?? groupByGroupLimit.value)) {
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

      return group
    }

    async function loadGroups(
      params: any = {},
      group?: Group,
      _options?: {
        triggerChildOnly: boolean
      },
    ) {
      try {
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

        if (isPublic && !sharedView.value?.uuid) {
          return
        }

        if (groupby.column.uidt === UITypes.LinkToAnotherRecord) {
          const relatedTableMeta = await getMeta(
            (groupby.column.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
          )
          if (!relatedTableMeta) return
          group.displayValueProp = (relatedTableMeta.columns?.find((c) => c.pv) || relatedTableMeta.columns?.[0])?.title || ''
        }

        // if (!options?.triggerChildOnly) {
        const response = !isPublic
          ? await api.dbViewRow.groupBy('noco', base.value.id, view.value.fk_model_id, view.value.id, {
              offset: ((group.paginationData.page ?? 0) - 1) * groupByGroupLimit.value,
              limit: groupByGroupLimit.value,
              ...params,
              ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
              where: `${nestedWhere}`,
              sort: `${getSortParams(groupby.sort)}${groupby.column.title}`,
              column_name: groupby.column.title,
            } as any)
          : await api.public.dataGroupBy(
              sharedView.value!.uuid!,
              {
                offset: ((group.paginationData.page ?? 0) - 1) * groupByGroupLimit.value,
                limit: groupByGroupLimit.value,
                ...params,
                where: nestedWhere,
                sort: `${getSortParams(groupby.sort)}${groupby.column.title}`,
                column_name: groupby.column.title,
                sortsArr: sorts.value,
                filtersArr: nestedFilters.value,
              },
              {
                headers: {
                  'xc-password': sharedViewPassword.value,
                },
              },
            )

        group = await processGroupData(response, group)
        // }

        if (appInfo.value.ee && group?.children?.length) {
          const aggregationAliasMapper = new AliasMapper()

          const aggregation = Object.values(gridViewCols.value)
            .map((f) => ({
              field: f.fk_column_id!,
              type: f.aggregation ?? CommonAggregations.None,
            }))
            .filter((f) => f.type !== CommonAggregations.None)

          const aggregationParams = (group.children ?? []).map((child) => {
            return {
              where: calculateNestedWhere(child.nestedIn, where?.value),
              alias: aggregationAliasMapper.generateAlias(child.key),
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            }
          })

          let aggResponse = {}

          if (aggregation.length) {
            aggResponse = !isPublic
              ? await api.dbDataTableBulkAggregate.dbDataTableBulkAggregate(
                  meta.value!.id,
                  {
                    viewId: view.value!.id,
                    aggregation,
                  },
                  aggregationParams,
                )
              : await fetchBulkAggregatedData(
                  {
                    aggregation,
                  },
                  aggregationParams,
                )

            await aggregationAliasMapper.process(aggResponse, (originalKey, value) => {
              const child = (group?.children ?? []).find((c) => c.key.toString() === (originalKey as any).toString())
              if (child) {
                Object.assign(child.aggregations, value)
              }
            })
          }
        }
      } catch (e) {
        console.log(e)
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    async function loadGroupData(group: Group, force = false, params: any = {}) {
      try {
        if (!base?.value?.id || !view.value?.id || !view.value?.fk_model_id) return

        if (group.children && !force) return

        if (!group.paginationData) {
          group.paginationData = { page: 1, pageSize: groupByRecordLimit.value }
        }

        const nestedWhere = calculateNestedWhere(group.nestedIn, where?.value)

        const query = {
          offset: ((group.paginationData.page ?? 0) - 1) * (group.paginationData.pageSize ?? groupByRecordLimit.value),
          limit: group.paginationData.pageSize ?? groupByRecordLimit.value,
          where: `${nestedWhere}`,
        }

        const response = !isPublic
          ? await api.dbViewRow.list('noco', base.value.id, view.value.fk_model_id, view.value.id, {
              ...query,
              ...params,
              ...(isUIAllowed('sortSync') ? {} : { sortArrJson: JSON.stringify(sorts.value) }),
              ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
            } as any)
          : await fetchSharedViewData({ sortsArr: sorts.value, filtersArr: nestedFilters.value, ...query }, { isGroupBy: true })

        group.count = response.pageInfo.totalRows ?? 0
        group.rows = formatData(response.list)
        group.paginationData = response.pageInfo
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    async function loadGroupAggregation(
      group: Group,
      fields?: Array<{
        field: string
        type: string
      }>,
    ) {
      try {
        if (!meta?.value?.id || !view.value?.id || !view.value?.fk_model_id || !appInfo.value.ee) return

        let filteredFields = fields
        if (!fields) {
          filteredFields = Object.values(gridViewCols.value).map((f) => ({
            field: f.fk_column_id!,
            type: f.aggregation ?? CommonAggregations.None,
          }))
        }

        filteredFields = filteredFields?.filter((x) => x.type !== CommonAggregations.None)

        if ((filteredFields && !filteredFields?.length) || !group.children?.length) return

        const aliasMapper = new AliasMapper()

        const aggregationParams = (group.children ?? []).map((child) => {
          return {
            where: calculateNestedWhere(child.nestedIn, where?.value),
            alias: aliasMapper.generateAlias(child.key),
            ...(isUIAllowed('filterSync') ? {} : { filterArrJson: JSON.stringify(nestedFilters.value) }),
          }
        })

        const response = !isPublic
          ? await api.dbDataTableBulkAggregate.dbDataTableBulkAggregate(
              meta.value!.id,
              {
                viewId: view.value!.id,
                ...(filteredFields ? { aggregation: filteredFields } : {}),
              },
              aggregationParams,
            )
          : await fetchBulkAggregatedData(
              {
                ...(filteredFields ? { aggregation: filteredFields } : {}),
              },
              aggregationParams,
            )

        await aliasMapper.process(response, (originalKey, value) => {
          const child = (group.children ?? []).find((c) => c.key.toString() === originalKey.toString())
          if (child) {
            Object.assign(child.aggregations, value)
          }
        })
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    const loadGroupPage = async (group: Group, p: number) => {
      if (!group.paginationData) {
        group.paginationData = { page: 1, pageSize: groupByRecordLimit.value }
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
          rootGroup.value.paginationData = { page: 1, pageSize: groupByGroupLimit.value }
          rootGroup.value.column = {} as any
          refreshNested()
          nextTick(() => reloadViewDataHook?.trigger())
        }
      },
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

          return (
            g.key ===
            valueToTitle(row.row[groupBy.value[nestLevel].column.title!], groupBy.value[nestLevel].column, group.displayValueProp)
          )
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
            } else {
              rootGroup.value.rows?.splice(rootGroup.value.rows!.indexOf(row), 1)
            }
            // if (properGroup.group?.children) loadGroups({}, properGroup.group)
          }
        })
      } else {
        group.children?.forEach((g) => redistributeRows(g))
      }
    }

    const loadAllowedLookups = async () => {
      const filteredLookupCols = []
      try {
        for (const col of meta?.value?.columns || []) {
          if (col.uidt !== UITypes.Lookup) continue

          let nextCol: ColumnType = col
          // check the lookup column is supported type or not
          while (nextCol && nextCol.uidt === UITypes.Lookup) {
            const lookupRelation = (await getMeta(nextCol.fk_model_id as string))?.columns?.find(
              (c) => c.id === (nextCol?.colOptions as LookupType).fk_relation_column_id,
            )

            if (!lookupRelation?.colOptions) break

            const relatedTableMeta = await getMeta(
              (lookupRelation?.colOptions as LinkToAnotherRecordType).fk_related_model_id as string,
            )

            nextCol = relatedTableMeta?.columns?.find(
              (c) => c.id === ((nextCol?.colOptions as LookupType).fk_lookup_column_id as string),
            ) as ColumnType

            // if next column is same as root lookup column then break the loop
            // since it's going to be a circular loop, and ignore the column
            if (nextCol?.id === col.id) {
              break
            }
          }

          if (nextCol?.uidt !== UITypes.Attachment && col.id) filteredLookupCols.push(col.id)
        }

        supportedLookups.value = filteredLookupCols
      } catch (e) {
        console.error(e)
      }
    }

    watch([() => view?.value?.id, () => meta.value?.columns], async ([newViewId]) => {
      // reload only if view belongs to current table
      if (newViewId && view.value?.fk_model_id === meta.value?.id) {
        await loadAllowedLookups()
      }
    })

    return {
      rootGroup,
      groupBy,
      isGroupBy,
      fieldsToGroupBy,
      groupByLimit,
      loadGroups,
      loadGroupData,
      loadGroupPage,
      loadGroupAggregation,
      groupWrapperChangePage,
      redistributeRows,
    }
  },
  'useViewGroupBy',
)

export { useProvideViewGroupBy }

export function useViewGroupByOrThrow() {
  const viewColumns = useViewGroupBy()
  if (viewColumns == null) throw new Error('Please call `useProvideViewGroupBy` on the appropriate parent component')
  return viewColumns
}

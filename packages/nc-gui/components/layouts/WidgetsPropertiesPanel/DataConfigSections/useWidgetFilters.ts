import type { ColumnType, FilterType, Widget } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { SelectProps } from 'ant-design-vue'
import type { Ref } from 'nuxt/dist/app/compat/capi'
import type { Filter } from '~~/lib'

const useWidgetFilters = (widget: Ref<Widget | undefined>, parentId?: string) => {
  const { $api, $e } = useNuxtApp()

  const dashboardStore = useDashboardStore()
  const { availableColumnsOfSelectedView: columns, focusedWidget, openedLayoutId } = storeToRefs(dashboardStore)
  const { reloadWidgetDataEventBus } = dashboardStore
  const router = useRouter()
  const route = $(router.currentRoute)
  const filters = ref<Filter[]>([])
  const openedProjectId = computed<string>(() => route.params.projectId as string)

  const options = computed<SelectProps['options']>(() => {
    return columns.value?.filter((c: ColumnType) => {
      if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID || c.system) {
        return false
      } else {
        const isVirtualSystemField = c.colOptions && c.system
        return !isVirtualSystemField
      }
    })
  })

  const filterOptionsAvailable = computed(() => options.value?.length && options.value.length > 0)

  const types = computed(() => {
    if (!columns.value?.length) {
      return {}
    }

    return columns.value?.reduce((obj: any, col: any) => {
      obj[col.id] = col.uidt
      return obj
    }, {})
  })

  //   const setColumns = (cols: ColumnType[]) => {
  //     columns.value = cols
  //   }

  const isComparisonOpAllowed = (
    filter: FilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      if (filter.fk_column_id && compOp.includedTypes.includes(types.value[filter.fk_column_id])) {
        return true
        // for 'empty', 'notempty', 'null', 'notnull',
        // show them based on `showNullAndEmptyInFilter` in Project Settings
        // TODO: consider to take showNullAndEmptyInFilter for Dashboards into account as well:
        // return isNullOrEmptyOp ? projectMeta.value.showNullAndEmptyInFilter : true
      } else {
        return false
      }
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      if (filter.fk_column_id && !compOp.excludedTypes.includes(types.value[filter.fk_column_id])) {
        // for 'empty', 'notempty', 'null', 'notnull',
        // show them based on `showNullAndEmptyInFilter` in Project Settings
        return true
      } else {
        return false
      }
    }
    // explicitly include for non-null / non-empty ops
    // return isNullOrEmptyOp ? projectMeta.value.showNullAndEmptyInFilter : true
    return true
  }

  const isComparisonSubOpAllowed = (
    filter: FilterType,
    compOp: {
      text: string
      value: string
      ignoreVal?: boolean
      includedTypes?: UITypes[]
      excludedTypes?: UITypes[]
    },
  ) => {
    if (compOp.includedTypes) {
      // include allowed values only if selected column type matches
      return filter.fk_column_id && compOp.includedTypes.includes(types.value[filter.fk_column_id])
    } else if (compOp.excludedTypes) {
      // include not allowed values only if selected column type not matches
      return filter.fk_column_id && !compOp.excludedTypes.includes(types.value[filter.fk_column_id])
    }
  }

  const placeholderFilter = (): Filter => {
    return {
      comparison_op: comparisonOpList(options.value?.[0].uidt as UITypes).filter((compOp) => {
        return isComparisonOpAllowed({ fk_column_id: options.value?.[0].id }, compOp)
      })?.[0].value as FilterType['comparison_op'],
      value: '',
      status: 'create',
      logical_op: 'and',
    }
  }

  const loadFilters = async () => {
    try {
      if (parentId) {
        filters.value = (await $api.dbTableFilter.childrenRead(parentId)).list as Filter[]
      } else {
        filters.value = (
          await $api.dashboard.widgetFilterRead(openedProjectId.value!, openedLayoutId.value!, focusedWidget.value!.id)
        ).list as Filter[]
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  const saveOrUpdate = async (filter: Filter, i: number) => {
    if (!openedLayoutId.value || !focusedWidget.value || !widget.value) return

    try {
      if (filter.id && filter.status !== 'create') {
        await $api.dbTableFilter.update(filter.id, {
          ...filter,
          fk_parent_id: parentId,
        })
        $e('a:dashboard-filter:update', {
          logical: filter.logical_op,
          comparison: filter.comparison_op,
        })
      } else {
        filters.value[i] = await $api.dashboard.widgetFilterCreate(
          openedProjectId.value!,
          openedLayoutId.value!,
          focusedWidget.value.id,
          {
            ...filter,
            fk_parent_id: parentId,
          },
        )
      }
    } catch (e: any) {
      console.log(e)
      message.error(await extractSdkResponseErrorMsg(e))
    }
    reloadWidgetDataEventBus.emit(widget.value.id)
  }

  const deleteFilter = async (filter: Filter, i: number) => {
    // if shared or sync permission not allowed simply remove it from array
    if (widget.value == null) {
      return
    }
    if (filter.id) {
      // if auto-apply disabled mark it as disabled
      try {
        await $api.dbTableFilter.delete(filter.id)
        filters.value.splice(i, 1)
      } catch (e: any) {
        console.log(e)
        message.error(await extractSdkResponseErrorMsg(e))
      }
      // if not synced yet remove it from array
    } else {
      filters.value.splice(i, 1)
    }
    $e('a:filter:delete', { length: filters.value.length })
    reloadWidgetDataEventBus.emit(widget.value.id)
  }

  const addFilter = async () => {
    filters.value.push(placeholderFilter())

    $e('a:filter:add', { length: filters.value.length })
  }

  const addFilterGroup = async () => {
    const placeHolderGroupFilter: Filter = {
      is_group: true,
      status: 'create',
      logical_op: 'and',
    }

    filters.value.push(placeHolderGroupFilter)

    const index = filters.value.length - 1

    await saveOrUpdate(filters.value[index], index)

    $e('a:filter:add', { length: filters.value.length, group: true })
  }

  return {
    filters,
    addFilterGroup,
    addFilter,
    isComparisonOpAllowed,
    isComparisonSubOpAllowed,
    deleteFilter,
    saveOrUpdate,
    loadFilters,
    filterOptionsAvailable,
  }
}

export default useWidgetFilters

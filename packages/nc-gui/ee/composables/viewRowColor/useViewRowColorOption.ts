import {
  PlanLimitTypes,
  ROW_COLORING_MODE,
  type RowColoringInfo,
  type RowColoringInfoFilter,
  type TableType,
  UITypes,
  type ViewType,
} from 'nocodb-sdk'
import type { FilterRowChangeEvent } from '#imports'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
  viewFieldsMap: ComputedRef<Record<string, any>>
}) {
  const { $api } = useNuxtApp()

  const view = params.view

  const viewFieldsMap = params.viewFieldsMap

  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

  const { activeViewRowColorInfo: rowColorInfo, views } = storeToRefs(useViewsStore())

  const { eventBus } = useSmartsheetStoreOrThrow()

  const { clone } = useUndoRedo()

  const meta = inject(MetaInj, ref())
  const { metas } = useMetas()
  const { getPlanLimit } = useWorkspace()

  const baseStore = useBase()
  const { baseMeta } = baseStore

  const isLoadingFilter = ref(false)

  // newly added condition is not saved directly to server until another action is taken
  // this is to handle that
  const pendingAction: Ref<() => Promise<void> | null> = ref(null)
  const pushPendingAction = async (handle: () => Promise<void>) => {
    if (pendingAction.value) {
      await pendingAction.value()
    }
    pendingAction.value = handle
  }
  const popPendingAction = async () => {
    if (pendingAction.value) {
      await pendingAction.value()
    }
    pendingAction.value = null
  }

  const onDropdownOpen = () => {
    rowColorInfo.value = Object.assign(
      {
        mode: null,
        conditions: [],
      },
      rowColorInfo.value,
    )
  }

  const filterColumns = computedAsync(async () => {
    if (!metas.value || Object.keys(metas.value).length === 0) return []
    return await composeColumnsForFilter({ rootMeta: meta.value, getMeta: async (id) => metas.value[id] })
  }, [])

  const getViewById = (viewId: string) => {
    return views.value.find((v) => v.id === viewId)
  }

  const updateViewLocalState = (viewId: string, updateObj: Partial<ViewType>) => {
    const view = getViewById(viewId)

    if (!view) return

    Object.assign(view, updateObj)
  }

  const reloadViewDataIfNeeded = (columnId?: string) => {
    if (!columnId || !viewFieldsMap.value) return

    if (!viewFieldsMap.value[columnId]?.show) {
      reloadViewDataHook.trigger({ shouldShowLoading: false })
    }
  }

  const onRemoveRowColoringMode = async () => {
    await $api.dbView.deleteViewRowColor(params.view.value.id)
    rowColorInfo.value = { mode: null, conditions: [] }

    const viewMeta = parseProp(getViewById(params.view.value.id!)?.meta)

    delete viewMeta.rowColoringInfo

    updateViewLocalState(params.view.value.id!, {
      row_coloring_mode: null,
      meta: viewMeta,
    })

    eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
  }

  const onRowColorSelectChange = async (columnChanged?: boolean = false) => {
    isLoadingFilter.value = true

    if (rowColorInfo.value.fk_column_id) {
      await $api.dbView.viewRowColorSelectAdd(params.view.value.id, rowColorInfo.value)

      const viewMeta = parseProp(getViewById(params.view.value.id!)?.meta)

      updateViewLocalState(params.view.value.id!, {
        row_coloring_mode: ROW_COLORING_MODE.SELECT,
        meta: {
          ...viewMeta,
          rowColoringInfo: {
            fk_column_id: rowColorInfo.value.fk_column_id,
            is_set_as_background: rowColorInfo.value.is_set_as_background,
          },
        },
      })

      eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)

      if (columnChanged) {
        reloadViewDataIfNeeded(rowColorInfo.value.fk_column_id)
      }
    }
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)

    isLoadingFilter.value = false
  }

  const onRowColorConditionAdd = async () => {
    const evalColumn = filterColumns.value.find((k) => k.pv)
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const filter = {
      id: undefined,
      tmp_id: generateUniqueRandomUUID([], ['id', 'tmp_id']),
      fk_column_id: evalColumn?.id,
      comparison_op: 'eq',
      is_group: false,
      logical_op: 'and',
      order: 1,
    }

    adjustFilterWhenColumnChange({
      column: evalColumn,
      filter,
      showNullAndEmptyInFilter: baseMeta.value?.showNullAndEmptyInFilter,
    })

    const conditionToAdd = {
      id: undefined,
      tmp_id: generateUniqueRandomUUID(conditions, ['id', 'tmp_id']),
      color: getThemeV3RandomColor(conditions.length),
      conditions: [filter],
      is_set_as_background: false,
      nestedConditions: [filter],
      nc_order: conditions.length + 1,
    }
    conditions.push(conditionToAdd)

    await pushPendingAction(async () => {
      const response = await $api.dbView.viewRowColorConditionAdd(params.view.value.id, {
        ...conditionToAdd,
        filter,
      })
      conditionToAdd.id = response.id
      const rowColoringResponse: RowColoringInfo = response.info
      if (conditionToAdd.conditions[0]) {
        conditionToAdd.conditions[0].id = rowColoringResponse.conditions.find(
          (con) => con.id === conditionToAdd.id,
        ).conditions[0].id
        conditionToAdd.conditions[0].fk_row_color_condition_id = conditionToAdd.id
      }

      updateViewLocalState(params.view.value.id!, {
        row_coloring_mode: ROW_COLORING_MODE.FILTER,
      })
    })

    reloadViewDataIfNeeded(evalColumn?.id)

    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
  }

  const onChangeRowColoringMode = async (mode: string) => {
    if (mode === ROW_COLORING_MODE.SELECT) {
      const selectColumn = meta.value?.columns?.find((k) => k.uidt === UITypes.SingleSelect)
      rowColorInfo.value.fk_column_id = selectColumn?.id
      rowColorInfo.value.is_set_as_background = false
      if (rowColorInfo.value.fk_column_id) {
        await $api.dbView.viewRowColorSelectAdd(params.view.value.id, rowColorInfo.value)

        reloadViewDataIfNeeded(rowColorInfo.value.fk_column_id)
      }

      updateViewLocalState(params.view.value.id!, {
        row_coloring_mode: ROW_COLORING_MODE.SELECT,
        meta: {
          ...parseProp(getViewById(params.view.value.id!)?.meta),
          rowColoringInfo: {
            fk_column_id: rowColorInfo.value.fk_column_id,
            is_set_as_background: rowColorInfo.value.is_set_as_background,
          },
        },
      })

      eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
      eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
    } else if (mode === ROW_COLORING_MODE.FILTER) {
      onRowColorConditionAdd()
    }
  }

  const onRowColorConditionDelete = async (index: number) => {
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToDelete = conditions[index]
    const newConditions = conditions.filter((condition, i) => i !== index)
    await popPendingAction()

    if (newConditions.length === 0) {
      onRemoveRowColoringMode()
    } else {
      const deleteConditionId = conditionToDelete?.id

      conditions.splice(index, 1)
      if (deleteConditionId) {
        try {
          await $api.dbView.viewRowColorConditionDelete(params.view.value.id, deleteConditionId)
        } catch (err: any) {
          console.log('error', err)
        }

        eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
      }

      eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
    }
  }

  const onRowColorConditionUpdate = async (params: {
    index: number
    color: string
    is_set_as_background: boolean
    nc_order?: number
  }) => {
    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToUpdate = conditions[params.index]!
    conditionToUpdate.is_set_as_background = params.is_set_as_background
    conditionToUpdate.color = params.color
    try {
      await $api.dbView.viewRowColorConditionUpdate(view.value.id, conditionToUpdate?.id, {
        color: params.color,
        is_set_as_background: params.is_set_as_background,
        nc_order: params.nc_order ?? conditionToUpdate.nc_order,
      })
    } catch (err: any) {
      console.log('error', err)
    }
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
  }

  const onRowColorConditionFilterAdd = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    isLoadingFilter.value = true

    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToAdd = conditions[colorIndex]!
    const evalColumn = filterColumns.value.find((k) => k.pv)
    const filter = {
      id: undefined,
      tmp_id: params.tmp_id,
      fk_row_color_condition_id: conditionToAdd.id,
      fk_parent_id: params.fk_parent_id,
      fk_column_id: evalColumn?.id,
      comparison_op: 'eq',
      is_group: false,
      logical_op: conditionToAdd.conditions[0]?.logical_op ?? 'and',
      order: conditionToAdd.conditions.length + 1,
    }

    adjustFilterWhenColumnChange({
      column: evalColumn,
      filter,
      showNullAndEmptyInFilter: baseMeta.value?.showNullAndEmptyInFilter,
    })
    conditionToAdd.conditions.push(filter)
    let parentFilter = null
    if (params.fk_parent_id) {
      parentFilter = conditionToAdd.conditions.find((f) => f.id === params.fk_parent_id)!
      parentFilter.children?.push(filter)
    } else if (params.parentFilter) {
      parentFilter = params.parentFilter
      parentFilter.children?.push(filter)
    } else {
      conditionToAdd.nestedConditions.push(filter)
    }
    await pushPendingAction(async () => {
      const toInsert = { ...filter, fk_parent_id: parentFilter?.id ?? filter.fk_parent_id }
      const result = await $api.rowColorConditions.rowColorConditionsFilterCreate(conditionToAdd.id, toInsert)
      filter.id = result.id
    })

    reloadViewDataIfNeeded(evalColumn?.id)

    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)

    isLoadingFilter.value = false
  }

  const onRowColorConditionFilterAddGroup = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    isLoadingFilter.value = true

    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToAdd = conditions[colorIndex]!
    const filter = {
      id: undefined,
      tmp_id: params.tmp_id,
      fk_row_color_condition_id: conditionToAdd.id,
      fk_parent_id: params.fk_parent_id,
      is_group: true,
      children: [],
      logical_op: conditionToAdd.conditions[0]?.logical_op ?? 'and',
      order: conditionToAdd.conditions.length + 1,
    }

    conditionToAdd.conditions.push(filter)
    let parentFilter = null
    if (params.fk_parent_id) {
      parentFilter = conditionToAdd.conditions.find((f) => f.id === params.fk_parent_id)!
      parentFilter.children?.push(filter)
    } else if (params.parentFilter) {
      parentFilter = params.parentFilter
      parentFilter.children?.push(filter)
    } else {
      conditionToAdd.nestedConditions.push(filter)
    }
    await pushPendingAction(async () => {
      const toInsert = { ...filter, fk_parent_id: parentFilter?.id ?? filter.fk_parent_id }
      delete toInsert.children
      const result = await $api.rowColorConditions.rowColorConditionsFilterCreate(conditionToAdd.id, toInsert)
      filter.id = result.id
    })
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)

    isLoadingFilter.value = false
  }

  const onRowColorConditionFilterUpdate = async (colorIndex: number, params: FilterRowChangeEvent) => {
    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToUpdate = conditions[colorIndex]!
    const filter = conditionToUpdate.conditions.find((k) => k.id === params.filter!.id)!

    if (!filter) return

    filter[params.type] = params.value
    if (params.filter!.fk_column_id && ['fk_column_id'].includes(params.type)) {
      const evalColumn = filterColumns.value.find((k) => k.id === params.filter!.fk_column_id)
      adjustFilterWhenColumnChange({
        column: evalColumn,
        filter,
        showNullAndEmptyInFilter: baseMeta.value?.showNullAndEmptyInFilter,
      })

      if (params.prevValue && evalColumn?.id && params.prevValue !== evalColumn?.id) {
        reloadViewDataIfNeeded(evalColumn?.id)
      }
    }

    if (['logical_op'].includes(params.type)) {
      const siblings = filter.fk_parent_id
        ? conditionToUpdate.conditions.find((f) => f.id === filter.fk_parent_id)?.children
        : conditionToUpdate.conditions.filter((f) => !f.fk_parent_id)
      for (const sibling of siblings ?? []) {
        sibling.logical_op = params.value
        const updateObj = { ...sibling }
        delete updateObj.children

        if (updateObj.id) {
          await $api.dbTableFilter.update(updateObj.id, updateObj)
        }
      }
    }
    const updateObj = { ...filter }
    delete updateObj.children

    if (filter.id) {
      await $api.dbTableFilter.update(filter!.id, updateObj)
    }
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
  }

  const onRowColorConditionFilterDelete = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    isLoadingFilter.value = true

    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToDelete = conditions[colorIndex]!
    const filterToDelete = conditionToDelete.conditions.find((k) => k.id === params.filter!.id)!

    if (!filterToDelete?.id) {
      isLoadingFilter.value = false

      return
    }

    try {
      const deletedFilterIds = await deleteFilterWithSub($api, filterToDelete)

      conditionToDelete.conditions = conditionToDelete.conditions.filter((f) => f.id !== filterToDelete.id)
      if (params.fk_parent_id) {
        const parentFilter = conditionToDelete.conditions.find((f) => f.id === params.fk_parent_id)
        parentFilter.children = parentFilter.children.filter((f) => f.id !== filterToDelete.id)
      } else {
        conditionToDelete.nestedConditions = conditionToDelete.nestedConditions.filter((f) => f.id !== filterToDelete.id)
      }
      conditionToDelete.conditions = conditionToDelete.conditions.filter((fil) => !deletedFilterIds.includes(fil.id))

      if (!conditionToDelete.conditions.length && !conditionToDelete.nestedConditions.length) {
        onRowColorConditionDelete(colorIndex)
      } else {
        eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
      }
    } catch (err: any) {
      console.log('error', err)
    }

    isLoadingFilter.value = false
  }

  const onRowColorConditionFilterCopy = async (colorIndex: number, params: FilterRowChangeEvent) => {
    isLoadingFilter.value = true

    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToAdd = conditions[colorIndex]!

    // Extract filter details from params (following same pattern as deleteFilter/copyFilter in FilterGroup.vue)
    const filterToCopy = params.filter
    if (!filterToCopy) {
      isLoadingFilter.value = false
      return
    }

    const isGroup = filterToCopy.is_group

    if (isGroup) {
      // For group filter copy, copy with children but without ids
      const copyFilterRecursively = (originalFilter: any): any => {
        const copiedFilter: any = {
          id: undefined,
          tmp_id: generateUniqueRandomUUID(conditionToAdd.conditions, ['id', 'tmp_id']),
          fk_row_color_condition_id: conditionToAdd.id,
          fk_parent_id: originalFilter.fk_parent_id,
          fk_column_id: originalFilter.fk_column_id,
          comparison_op: originalFilter.comparison_op,
          comparison_sub_op: originalFilter.comparison_sub_op,
          is_group: originalFilter.is_group,
          logical_op: originalFilter.logical_op,
          value: originalFilter.value,
          order: originalFilter.order,
        }

        // Recursively copy children if they exist
        if (originalFilter.children && originalFilter.children.length > 0) {
          copiedFilter.children = originalFilter.children
            .filter((child: any) => child)
            .map((child: any) => copyFilterRecursively(child))
        } else if (originalFilter.is_group) {
          copiedFilter.children = []
        }

        return copiedFilter
      }

      const filter = copyFilterRecursively(filterToCopy)
      // Update order for the root group filter - max of current group or root
      let nextOrder: number
      if (filterToCopy.fk_parent_id) {
        // If copying into a group, find the max order among siblings
        const parentFilter = conditionToAdd.conditions.find((f) => f.id === filterToCopy.fk_parent_id)
        if (parentFilter?.children?.length) {
          nextOrder = Math.max(...parentFilter.children.map((child: any) => child?.order ?? 0)) + 1
        } else {
          nextOrder = 1
        }
      } else {
        // If copying to root level, find the max order among root filters
        const rootFilters = conditionToAdd.conditions.filter((f) => !f.fk_parent_id)
        nextOrder = rootFilters.length ? Math.max(...rootFilters.map((f: any) => f?.order ?? 0)) + 1 : 1
      }
      filter.order = nextOrder

      conditionToAdd.conditions.push(filter)
      let parentFilter = null
      if (filter.fk_parent_id) {
        parentFilter = conditionToAdd.conditions.find((f) => f.id === filter.fk_parent_id)
        parentFilter.children?.push(filter)
      } else if (filterToCopy.fk_parent_id) {
        parentFilter = conditionToAdd.conditions.find((f) => f.id === filterToCopy.fk_parent_id)
        parentFilter.children?.push(filter)
      } else {
        conditionToAdd.nestedConditions.push(filter)
      }

      await pushPendingAction(async () => {
        const filterToCreate = { ...filter, fk_parent_id: parentFilter?.id ?? filter.fk_parent_id }
        // Don't delete children - Filter.insert supports children directly
        const result = await $api.rowColorConditions.rowColorConditionsFilterCreate(conditionToAdd.id, filterToCreate)
        filter.id = result.id
      })

      await popPendingAction()
    } else {
      // For regular filter copy, follow the same pattern as onRowColorConditionFilterAdd
      // but with pre-configured values from the filter being copied

      // Calculate order: max of current group or root
      let nextOrder: number
      if (filterToCopy.fk_parent_id) {
        // If copying into a group, find the max order among siblings
        const parentFilter = conditionToAdd.conditions.find((f) => f.id === filterToCopy.fk_parent_id)
        if (parentFilter?.children?.length) {
          nextOrder = Math.max(...parentFilter.children.map((child: any) => child?.order ?? 0)) + 1
        } else {
          nextOrder = 1
        }
      } else {
        // If copying to root level, find the max order among root filters
        const rootFilters = conditionToAdd.conditions.filter((f) => !f.fk_parent_id)
        nextOrder = rootFilters.length ? Math.max(...rootFilters.map((f: any) => f?.order ?? 0)) + 1 : 1
      }

      const filter = {
        id: undefined,
        tmp_id: generateUniqueRandomUUID(conditionToAdd.conditions, ['id', 'tmp_id']),
        fk_row_color_condition_id: conditionToAdd.id,
        fk_parent_id: filterToCopy.fk_parent_id, // Keep the same parent as the original
        fk_column_id: filterToCopy.fk_column_id,
        comparison_op: filterToCopy.comparison_op,
        comparison_sub_op: filterToCopy.comparison_sub_op,
        is_group: false,
        logical_op: filterToCopy.logical_op || conditionToAdd.conditions[0]?.logical_op || 'and',
        value: filterToCopy.value,
        order: nextOrder,
      }

      conditionToAdd.conditions.push(filter)
      let parentFilter = null
      if (filter.fk_parent_id) {
        parentFilter = conditionToAdd.conditions.find((f) => f.id === filter.fk_parent_id)
        parentFilter.children?.push(filter)
      } else if (filterToCopy.fk_parent_id) {
        parentFilter = conditionToAdd.conditions.find((f) => f.id === filterToCopy.fk_parent_id)
        parentFilter.children?.push(filter)
      } else {
        conditionToAdd.nestedConditions.push(filter)
      }

      await pushPendingAction(async () => {
        const toInsert = { ...filter, fk_parent_id: parentFilter?.id ?? filter.fk_parent_id }
        const result = await $api.rowColorConditions.rowColorConditionsFilterCreate(conditionToAdd.id, toInsert)
        filter.id = result.id
      })

      await popPendingAction()

      reloadViewDataIfNeeded(filter.fk_column_id)
    }

    eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)

    isLoadingFilter.value = false
  }

  const onRowColorConditionCopy = async (index: number) => {
    isLoadingFilter.value = true

    await popPendingAction()

    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToCopy = conditions[index] ? clone(conditions[index]!) : null

    if (!conditionToCopy) {
      isLoadingFilter.value = false
      return
    }

    // Deep clone the condition and its nested filters with children structure
    const cloneFilter = (filter: any): any => {
      const clonedFilter: any = {
        id: undefined,
        tmp_id: generateUniqueRandomUUID([], ['id', 'tmp_id']),
        fk_row_color_condition_id: undefined,
        fk_parent_id: undefined,
        fk_column_id: filter.fk_column_id,
        comparison_op: filter.comparison_op,
        comparison_sub_op: filter.comparison_sub_op,
        is_group: filter.is_group,
        logical_op: filter.logical_op,
        value: filter.value,
        order: filter.order,
      }

      // Clone children recursively - Filter.insert supports children directly
      if (filter.children && filter.children.length > 0) {
        clonedFilter.children = filter.children.map((child: any) => cloneFilter(child))
      }

      return clonedFilter
    }

    // Clone nested conditions structure recursively with children
    const cloneNestedConditions = (nested: any[]): any[] => {
      return nested.map((item) => cloneFilter(item))
    }

    // Clone nested conditions, but exclude the first root filter since it's already created
    // The first root filter in nestedConditions corresponds to conditions[0] which is created separately
    const clonedNestedConditions = [...cloneNestedConditions(conditionToCopy.nestedConditions || [])]

    // Create the copied condition
    const copiedCondition: any = {
      id: undefined,
      tmp_id: generateUniqueRandomUUID(conditions, ['id', 'tmp_id']),
      color: conditionToCopy.color,
      is_set_as_background: conditionToCopy.is_set_as_background,
      nc_order: conditions.length + 1,
      conditions: conditionToCopy.conditions.map((filter) => cloneFilter(filter)),
      nestedConditions: clonedNestedConditions,
    }

    conditions.push(copiedCondition)

    await pushPendingAction(async () => {
      // Create the condition on the server without any filter
      const response = await $api.dbView.viewRowColorConditionAdd(params.view.value.id!, copiedCondition)
      copiedCondition.id = response.id

      // Create all copied filters in parallel using Promise.all
      // Each filter can have nested children, which Filter.insert will handle recursively
      if (copiedCondition.nestedConditions && copiedCondition.nestedConditions.length > 0) {
        copiedCondition.nestedConditions = await Promise.all(
          copiedCondition.nestedConditions.map(async (filter: any) => {
            const filterToCreate: any = {
              ...filter,
              fk_row_color_condition_id: copiedCondition.id,
            }
            delete filterToCreate.id

            // Create filter - Filter.insert supports children directly
            const createdFilter = await $api.rowColorConditions.rowColorConditionsFilterCreate(
              copiedCondition.id!,
              filterToCreate,
            )

            filterToCreate.id = createdFilter.id

            return filterToCreate
          }),
        )
      }

      updateViewLocalState(params.view.value.id!, {
        row_coloring_mode: ROW_COLORING_MODE.FILTER,
      })
    })

    await popPendingAction()

    eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)

    isLoadingFilter.value = false
  }

  const filterPerViewLimit = computed(() => getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW))

  return {
    rowColorInfo,
    filterColumns,
    filterPerViewLimit,
    isLoadingFilter,
    onDropdownOpen,
    onChangeRowColoringMode,
    onRemoveRowColoringMode,
    onRowColorSelectChange,
    onRowColorConditionAdd,
    onRowColorConditionDelete,
    onRowColorConditionUpdate,
    onRowColorConditionCopy,
    onRowColorConditionFilterAdd,
    onRowColorConditionFilterUpdate,
    onRowColorConditionFilterAddGroup,
    onRowColorConditionFilterDelete,
    onRowColorConditionFilterCopy,
  }
}

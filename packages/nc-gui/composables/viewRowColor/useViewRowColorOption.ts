import { PlanLimitTypes, type RowColoringInfo, type RowColoringInfoFilter, type TableType, type ViewType } from 'nocodb-sdk'
import type { FilterRowChangeEvent } from '#imports'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
}) {
  const { $api } = useNuxtApp()
  const view = params.view
  const rowColorInfo: Ref<RowColoringInfo> = inject(ViewRowColorInj)

  const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
  const meta = inject(MetaInj, ref())
  const { metas } = useMetas()
  const { getPlanLimit } = useWorkspace()

  const baseStore = useBase()
  const { getBaseType, baseMeta } = baseStore

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
  })

  const onRemoveRowColoringMode = async () => {
    await $api.dbView.deleteViewRowColor(params.view.value.id)
    rowColorInfo.value = { mode: null, conditions: [] }
    eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
  }

  const onRowColorSelectChange = async () => {
    if (rowColorInfo.value.fk_column_id) {
      await $api.dbView.viewRowColorSelectAdd(params.view.value.id, rowColorInfo.value)
      eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    }
  }

  const onRowColorConditionAdd = async () => {
    const evalColumn = filterColumns.value.find((k) => k.pv)
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const filter = {
      id: undefined,
      fk_column_id: evalColumn.id,
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
      color: theme.light[conditions.length % theme.light.length],
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
        conditionToAdd.conditions[0].fk_row_color_conditions_id = conditionToAdd.id
      }
    })
  }

  const onRowColorConditionDelete = async (index: number) => {
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToDelete = conditions[index]
    const newConditions = conditions.filter((condition, i) => i !== index)
    await popPendingAction()
    if (newConditions.length === 0) {
      await $api.dbView.deleteViewRowColor(params.view.value.id)
      eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
    } else {
      conditions.splice(index, 1)
      if (conditionToDelete.id) {
        await $api.dbView.viewRowColorConditionDelete(params.view.value.id, conditionToDelete.id)
        eventBus.emit(SmartsheetStoreEvents.ROW_COLOR_UPDATE)
      }
    }
  }

  const onRowColorConditionUpdate = async (params: { index: number; color: string; is_set_as_background: boolean }) => {
    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToUpdate = conditions[params.index]!
    conditionToUpdate.is_set_as_background = params.is_set_as_background
    conditionToUpdate.color = params.color
    await $api.dbView.viewRowColorConditionUpdate(view.value.id, conditionToUpdate?.id, {
      color: params.color,
      is_set_as_background: params.is_set_as_background,
      nc_order: conditionToUpdate.nc_order,
    })
  }

  const onRowColorConditionFilterAdd = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToAdd = conditions[colorIndex]!
    const evalColumn = filterColumns.value.find((k) => k.pv)
    const filter = {
      id: undefined,
      fk_row_color_conditions_id: conditionToAdd.id,
      fk_parent_id: params.fk_parent_id,
      fk_column_id: evalColumn.id,
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
  }

  const onRowColorConditionFilterAddGroup = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToAdd = conditions[colorIndex]!
    const filter = {
      id: undefined,
      fk_row_color_conditions_id: conditionToAdd.id,
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
  }

  const onRowColorConditionFilterUpdate = async (colorIndex: number, params: FilterRowChangeEvent) => {
    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToUpdate = conditions[colorIndex]!
    const filter = conditionToUpdate.conditions.find((k) => k.id === params.filter!.id)!

    filter[params.type] = params.value
    if (params.filter!.fk_column_id) {
      if (['fk_column_id'].includes(params.type)) {
        const evalColumn = filterColumns.value.find((k) => k.id === params.filter!.fk_column_id)
        adjustFilterWhenColumnChange({
          column: evalColumn,
          filter,
          showNullAndEmptyInFilter: baseMeta.value?.showNullAndEmptyInFilter,
        })
      } else if (['logical_op'].includes(params.type)) {
        const siblings = filter.fk_parent_id
          ? conditionToUpdate.conditions.find((f) => f.id === filter.fk_parent_id)?.children
          : conditionToUpdate.conditions.filter((f) => !f.fk_parent_id)
      }
    }
    await $api.dbTableFilter.update(filter!.id, filter)
  }

  const onRowColorConditionFilterDelete = async (colorIndex: number, params: FilterGroupChangeEvent) => {
    await popPendingAction()
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const conditionToDelete = conditions[colorIndex]!
    console.log('params.filter!.id', params.filter!.id)
    const filterToDelete = conditionToDelete.conditions.find((k) => k.id === params.filter!.id)!

    conditionToDelete.conditions = conditionToDelete.conditions.filter((f) => f.id !== filterToDelete.id)
    await $api.dbTableFilter.delete(filterToDelete!.id)
    if (params.fk_parent_id) {
      const parentFilter = conditionToDelete.conditions.find((f) => f.id === params.fk_parent_id)
      parentFilter.children = parentFilter.children.filter((f) => f.id !== filterToDelete.id)
    } else {
      conditionToDelete.nestedConditions = conditionToDelete.nestedConditions.filter((f) => f.id !== filterToDelete.id)
    }
  }

  const filterPerViewLimit = computed(() => getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW))

  return {
    rowColorInfo,
    filterColumns,
    filterPerViewLimit,
    onDropdownOpen,
    onRemoveRowColoringMode,
    onRowColorSelectChange,
    onRowColorConditionAdd,
    onRowColorConditionDelete,
    onRowColorConditionUpdate,
    onRowColorConditionFilterAdd,
    onRowColorConditionFilterUpdate,
    onRowColorConditionFilterAddGroup,
    onRowColorConditionFilterDelete,
  }
}

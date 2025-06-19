import { PlanLimitTypes, type RowColoringInfo, type RowColoringInfoFilter, type TableType, type ViewType } from 'nocodb-sdk'

export function useViewRowColorOption(params: {
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>
  view: Ref<ViewType>
}) {
  const { $api } = useNuxtApp()
  const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)
  const meta = inject(MetaInj, ref())
  const { metas } = useMetas()
  const { getPlanLimit } = useWorkspace()

  const baseStore = useBase()
  const { getBaseType, baseMeta } = baseStore

  const dbRowColorInfo: Ref<RowColoringInfo> = inject(ViewRowColorInj)

  const rowColorInfo = ref(
    Object.assign(
      {
        mode: null,
        conditions: [],
      },
      dbRowColorInfo.value,
    ),
  )

  watch(
    () => dbRowColorInfo,
    (oldValue, newValue) => {
      if (newValue?.value) {
        rowColorInfo.value = Object.assign(
          {
            mode: null,
            conditions: [],
          },
          newValue.value,
        )
      }
    },
  )

  const onDropdownOpen = () => {
    rowColorInfo.value = Object.assign(
      {
        mode: null,
        conditions: [],
      },
      dbRowColorInfo.value,
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
    const evalColumn = filterColumns.value[0]
    const conditions = (rowColorInfo.value as RowColoringInfoFilter).conditions
    const filter = {
      tmp_id: Math.random().toString(36).substring(2, 15),
      fk_column_id: evalColumn.id,
      comparison_op: 'eq',
      is_group: false,
      logical_op: 'and',
    }

    adjustFilterWhenColumnChange({
      column: evalColumn,
      filter,
      showNullAndEmptyInFilter: baseMeta.value.showNullAndEmptyInFilter,
    })
    const conditionToAdd = {
      color: theme.light[conditions.length % theme.light.length],
      conditions: [filter],
      is_set_as_background: false,
      nestedConditions: [filter],
      nc_order: conditions.length + 1,
    }
    conditions.push(conditionToAdd)
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
  }
}

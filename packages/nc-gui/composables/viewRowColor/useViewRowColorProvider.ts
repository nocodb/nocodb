import { ROW_COLORING_MODE, type RowColoringInfo, type ViewType, arrayToNested } from 'nocodb-sdk'

export function useViewRowColorProvider(params: { view: Ref<ViewType>; rowColorInfo?: Ref<RowColoringInfo> }) {
  const { $api } = useNuxtApp()
  const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)

  const rowColorInfo: Ref<RowColoringInfo> =
    params.rowColorInfo ??
    ref({
      __id: '',
      mode: null,
      conditions: [],
      fk_column_id: null,
      color: null,
      is_set_as_background: null,
    })

  const onRowColorInfoUpdated = () => {
    rowColorInfo.value.__id = Math.random().toString(36).substring(2, 15)
    console.log('rowColorInfo.value.__id', rowColorInfo.value.__id)
    // rowColorInfo.value = { ...rowColorInfo.value, __id: Math.random().toString(36).substring(2, 15) }
  }
  const reloadRowColorInfo = async () => {
    if (params.view.value?.id) {
      const rowColorInfoResponse = await $api.dbView.getViewRowColor(params.view.value?.id)
      if (rowColorInfoResponse) {
        rowColorInfo.value = rowColorInfoResponse
        if (rowColorInfo.value!.mode === ROW_COLORING_MODE.FILTER) {
          for (const condition of rowColorInfo.value.conditions) {
            condition.nestedConditions = arrayToNested({
              data: condition.conditions,
              childAssignHandler: (row, children) => {
                row.children = children
              },
              getFkHandler: (row) => row.fk_parent_id,
              getIdHandler: (row) => row.id,
              maxLevel: 999,
            })
          }
        }
      }
    }
  }

  if (!params.rowColorInfo) {
    // need to use watch here due to how ref params view work
    watch(
      () => params.view.value?.id,
      () => {
        reloadRowColorInfo()
      },
      { immediate: true },
    )
  }
  const setRowColorInfo = (value: RowColoringInfo) => {
    rowColorInfo.value = value
  }
  eventBus.on((event) => {
    if ([SmartsheetStoreEvents.ROW_COLOR_UPDATE, SmartsheetStoreEvents.FIELD_UPDATE].includes(event)) {
      reloadRowColorInfo()
    }
  })
  provide(ViewRowColorInj, rowColorInfo)
  return { rowColorInfo, reloadRowColorInfo, setRowColorInfo, onRowColorInfoUpdated }
}

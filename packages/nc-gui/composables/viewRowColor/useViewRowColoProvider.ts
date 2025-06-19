import { type RowColoringInfo, type ViewType } from 'nocodb-sdk'

export function useViewRowColorProvider(params: { view: Ref<ViewType>; rowColorInfo?: Ref<RowColoringInfo> }) {
  const { $api } = useNuxtApp()
  const eventBus = useEventBus<SmartsheetStoreEvents>(EventBusEnum.SmartsheetStore)

  const rowColorInfo: Ref<RowColoringInfo> = params.rowColorInfo ?? ref({})
  const reloadRowColorInfo = async () => {
    if (params.view.value?.id) {
      const rowColorInfoResponse = await $api.dbView.getViewRowColor(params.view.value?.id)
      if (rowColorInfoResponse) {
        rowColorInfo.value = rowColorInfoResponse
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
  return { rowColorInfo, reloadRowColorInfo, setRowColorInfo }
}

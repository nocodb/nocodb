import { ROW_COLORING_MODE, type RowColoringInfo, type ViewType, arrayToNested } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'
import type { UseEventBusReturn } from '@vueuse/core'
import { SmartsheetStoreEvents } from '#imports'

const defaultRowColorInfo: RowColoringInfo = {
  mode: null,
  conditions: [],
  fk_column_id: null,
  color: null,
  is_set_as_background: null,
}

export function useViewRowColorProvider(params: {
  view: Ref<ViewType>
  eventBus: UseEventBusReturn<SmartsheetStoreEvents, SmartsheetStoreEvents>
}) {
  const { $api } = useNuxtApp()

  const rowColorInfo: Ref<RowColoringInfo> = ref(defaultRowColorInfo)

  const reloadRowColorInfo = async () => {
    clearRowColouringCache()

    if (params.view.value?.id) {
      const rowColorInfoResponse = await $api.dbView.getViewRowColor(params.view.value?.id)
      if (rowColorInfoResponse) {
        rowColorInfo.value = rowColorInfoResponse
        if (rowColorInfo.value!.mode === ROW_COLORING_MODE.FILTER) {
          for (const condition of rowColorInfo.value.conditions) {
            condition.conditions = condition.conditions.sort((a, b) => a.order - b.order)
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

  // need to use watch here due to how ref params view work
  watch(
    () => params.view.value?.id,
    () => {
      reloadRowColorInfo()
    },
    { immediate: true },
  )
  const setRowColorInfo = (value: RowColoringInfo) => {
    rowColorInfo.value = value
  }
  params.eventBus.on((event) => {
    if ([SmartsheetStoreEvents.ROW_COLOR_UPDATE, SmartsheetStoreEvents.FIELD_UPDATE].includes(event)) {
      reloadRowColorInfo()
    }
  })
  provide(ViewRowColorInj, rowColorInfo)
  return { rowColorInfo, reloadRowColorInfo, setRowColorInfo }
}

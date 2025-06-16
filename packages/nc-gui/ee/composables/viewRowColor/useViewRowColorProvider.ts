import { ROW_COLORING_MODE, type RowColoringInfo, type ViewType, arrayToNested } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'
import { SmartsheetStoreEvents } from '#imports'

export function useViewRowColorProvider(params: { shared?: boolean }) {
  const { $api } = useNuxtApp()

  const { activeView, activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const { eventBus } = useSmartsheetStoreOrThrow()

  const viewId = computed(() => {
    if (params.shared) {
      return activeView.value?.view?.fk_view_id
    }

    return activeView.value?.id
  })

  /**
   * Reload row color info
   * @returns void
   */
  const reloadRowColorInfo = async (isViewChange: boolean = false) => {
    clearRowColouringCache()

    if (!viewId.value) return

    const rowColorInfoResponse = !params.shared
      ? await $api.dbView.getViewRowColor(viewId.value)
      : (activeView.value as ViewType & { viewRowColorInfo: RowColoringInfo | null })?.viewRowColorInfo

    eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE)

    if (!rowColorInfoResponse) {
      if (isViewChange) {
        activeViewRowColorInfo.value = defaultRowColorInfo
      }
      return
    }

    activeViewRowColorInfo.value = rowColorInfoResponse

    if (activeViewRowColorInfo.value!.mode === ROW_COLORING_MODE.FILTER) {
      for (const condition of activeViewRowColorInfo.value.conditions) {
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

    eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE)
  }

  /**
   * Watch viewId and reload row color info
   */
  watch(
    () => viewId.value,
    () => {
      reloadRowColorInfo(true)
    },
    { immediate: true },
  )

  /**
   * Watch row color update and field update events and reload row color info
   */
  eventBus.on((event) => {
    if (
      [SmartsheetStoreEvents.ROW_COLOR_UPDATE, SmartsheetStoreEvents.FIELD_UPDATE, SmartsheetStoreEvents.FIELD_RELOAD].includes(
        event,
      )
    ) {
      reloadRowColorInfo()
    }
  })

  return { reloadRowColorInfo }
}

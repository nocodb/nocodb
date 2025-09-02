import { ROW_COLORING_MODE, type RowColoringInfo, type RowColoringInfoFilter, type ViewType, arrayToNested } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../components/smartsheet/grid/canvas/utils/canvas'
import { SmartsheetStoreEvents } from '#imports'

export function useViewRowColorProvider(params: { shared?: boolean }) {
  const { $api, $eventBus } = useNuxtApp()

  const { activeView, activeViewRowColorInfo } = storeToRefs(useViewsStore())

  const { blockRowColoring } = useEeConfig()

  const { eventBus } = useSmartsheetStoreOrThrow()

  const viewId = computed(() => {
    if (params.shared) {
      return activeView.value?.view?.fk_view_id
    }

    return activeView.value?.id
  })

  const isRowColouringEnabled = computed(() => {
    return !blockRowColoring.value && activeViewRowColorInfo.value && !!activeViewRowColorInfo.value?.mode
  })

  /**
   * Reload row color info
   * @returns void
   */
  const reloadRowColorInfo = async (isViewChange: boolean = false, customPayload = null) => {
    clearRowColouringCache()

    if (!viewId.value) return

    const rowColorInfoResponse =
      customPayload ||
      (!params.shared
        ? await $api.dbView.getViewRowColor(viewId.value)
        : (activeView.value as ViewType & { viewRowColorInfo: RowColoringInfo | null })?.viewRowColorInfo)

    eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE)

    if (!rowColorInfoResponse) {
      if (isViewChange) {
        // need to remove conditions first
        // somehow it's not reactive
        const conditions = (activeViewRowColorInfo.value as RowColoringInfoFilter).conditions
        conditions?.splice(0)
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

    // add some delay before re-render as it is not reflecting immediately otherwise
    setTimeout(() => eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE), 100)
  }

  const evtListener = (evt: string, payload: any) => {
    // check if row color condition exists
    const condition =
      payload.fk_row_color_condition_id &&
      (activeViewRowColorInfo.value as RowColoringInfoFilter)?.conditions?.find((c) => c.id === payload.fk_row_color_condition_id)
    if (!condition) return

    // TODO: manipulate filters inline instead of reload
    if (evt === 'filter_create' || evt === 'filter_update' || evt === 'filter_delete') {
      reloadRowColorInfo()
    }
  }

  onMounted(() => {
    $eventBus.realtimeViewMetaEventBus.on(evtListener)
  })

  onBeforeUnmount(() => {
    $eventBus.realtimeViewMetaEventBus.off(evtListener)
  })

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
  eventBus.on((event, payload?: { viewChange?: boolean; rowColorInfo?: any }) => {
    if ([SmartsheetStoreEvents.ROW_COLOR_UPDATE].includes(event)) {
      reloadRowColorInfo(payload?.viewChange ?? false, payload?.rowColorInfo)
    } else if ([SmartsheetStoreEvents.FIELD_UPDATE, SmartsheetStoreEvents.FIELD_RELOAD].includes(event)) {
      reloadRowColorInfo(true)
    }
  })

  watch(
    isRowColouringEnabled,
    () => {
      eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
    },
    {
      immediate: true,
    },
  )

  return { reloadRowColorInfo }
}

import { ROW_COLORING_MODE, type RowColoringInfo, type RowColoringInfoFilter, type ViewType, arrayToNested } from 'nocodb-sdk'
import { SmartsheetStoreEvents } from '#imports'

export function useViewRowColorProvider(params: { shared?: boolean }) {
  const { $api, $eventBus } = useNuxtApp()

  const { isDark } = useTheme()

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
    if (!viewId.value) return

    const rowColorInfoResponse = !params.shared
      ? customPayload ||
        (await $api.internal.getOperation(activeView.value!.fk_workspace_id!, activeView.value!.base_id!, {
          operation: 'viewRowColorInfo',
          viewId: viewId.value,
        }))
      : (activeView.value as ViewType & { viewRowColorInfo: RowColoringInfo | null })?.viewRowColorInfo

    if (!rowColorInfoResponse) {
      if (isViewChange) {
        // need to remove conditions first
        // somehow it's not reactive
        const conditions = (activeViewRowColorInfo.value as RowColoringInfoFilter).conditions
        conditions?.splice(0)
        activeViewRowColorInfo.value = defaultRowColorInfo
      }

      await ncDelay(100)
      eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE)

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
    await ncDelay(100)
    eventBus.emit(SmartsheetStoreEvents.ON_ROW_COLOUR_INFO_UPDATE)
  }

  const evtListener = (evt: string, payload: any) => {
    if (['filter_create', 'filter_update', 'filter_delete'].includes(evt)) {
      // check if row color condition exists
      const condition =
        payload.fk_row_color_condition_id &&
        (activeViewRowColorInfo.value as RowColoringInfoFilter)?.conditions?.find(
          (c) => c.id === payload.fk_row_color_condition_id,
        )
      if (!condition) return

      // TODO: manipulate filters inline instead of reload
      reloadRowColorInfo()
    }
  }

  onMounted(() => {
    $eventBus.realtimeViewMetaEventBus.on(evtListener)
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
   * Watch row color update and field update events and reload row color info.
   *
   * A single column CUD can emit several of these events in quick succession
   * (e.g. `useColumnCreateStore` emits `FIELD_UPDATE` + `ROW_COLOR_UPDATE`,
   * the realtime socket then emits `FIELD_RELOAD` from `column_*` broadcasts,
   * and downstream listeners may emit `FIELD_RELOAD` again). Without
   * coalescing, each event hits `/row-color` independently — see #6778.
   *
   * Two paths to keep separate:
   *   - ROW_COLOR_UPDATE *with* a `rowColorInfo` payload: realtime socket
   *     already shipped the data, so `reloadRowColorInfo` skips the API and
   *     just applies. Fire that eagerly so the payload isn't dropped by a
   *     debounce that coalesces with a later no-arg FIELD_RELOAD.
   *   - Everything else (API-fetching paths): debounce on the trailing edge
   *     so the burst collapses to one `/row-color` GET. Use viewChange=true
   *     conservatively — that's what FIELD_RELOAD already passed pre-fix.
   */
  const reloadRowColorInfoDebounced = useDebounceFn(() => reloadRowColorInfo(true), 50)

  const smartsheetStoreEvents = async (event: SmartsheetStoreEvents, payload?: { viewChange?: boolean; rowColorInfo?: any }) => {
    if (event === SmartsheetStoreEvents.ROW_COLOR_UPDATE) {
      if (payload?.rowColorInfo) {
        // Apply realtime payload immediately; no API call to coalesce.
        reloadRowColorInfo(payload?.viewChange ?? false, payload?.rowColorInfo)
      } else {
        reloadRowColorInfoDebounced()
      }
    } else if (event === SmartsheetStoreEvents.FIELD_UPDATE || event === SmartsheetStoreEvents.FIELD_RELOAD) {
      /**
       * No need to check view config copied event as we call `SmartsheetStoreEvents.FIELD_RELOAD` after it
       */
      reloadRowColorInfoDebounced()
    }
  }

  eventBus.on(smartsheetStoreEvents)

  onBeforeUnmount(() => {
    eventBus.off(smartsheetStoreEvents)
    $eventBus.realtimeViewMetaEventBus.off(evtListener)
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

  watch(isDark, () => {
    eventBus.emit(SmartsheetStoreEvents.TRIGGER_RE_RENDER)
  })

  return { reloadRowColorInfo }
}

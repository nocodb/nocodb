import type { TableType, TimelineType, ViewType } from 'nocodb-sdk'
import type { ComputedRef } from 'vue'

const [useProvideTimelineViewStore, useTimelineViewStore] = useInjectionState(
  (
    _meta: Ref<TableType | undefined>,
    _viewMeta: Ref<(ViewType | TimelineType | undefined) & { id: string }>,
    _shared?: boolean,
    _where?: ComputedRef<string | undefined>,
  ) => {
    return {
      zoomLevel: ref<'day' | 'week' | 'month'>('week'),
      currentDate: ref(''),
      selectedDate: ref(null),
      formattedData: ref<any[]>([]),
      isTimelineDataLoading: ref(false),
      searchQuery: ref(''),
      timelineMetaData: ref({}),
      viewMetaProperties: computed(() => ({})),
      timelineRange: computed(() => []),
      visibleDates: computed(() => []),
      dateRangeLabel: computed(() => ''),
      isPublic: ref(false),
      totalRecordCount: ref(0),
      recordsWithoutDates: ref(0),
      updateFormat: computed(() => ''),
      updateRowProperty: async (..._args: any[]) => {},
      loadTimelineData: async () => {},
      navigateToClosestRecord: () => {},
      navigateNext: () => {},
      navigatePrev: () => {},
      goToToday: () => {},
      goToDate: (_date: any) => {},
      setZoomLevel: (_zoom: string) => {},
    }
  },
  'timeline-view-store',
)

export { useProvideTimelineViewStore }

export function useTimelineViewStoreOrThrow() {
  const store = useTimelineViewStore()
  if (!store) throw new Error('Timeline view store is not provided')
  return store
}

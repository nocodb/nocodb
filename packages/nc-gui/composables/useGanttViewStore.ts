// TEMPORARY CLONE — duplicated from Timeline/useTimelineViewStore on 2026-04-24.
// Rename pass: timeline → gantt. To be consolidated into components/smartsheet/shared/
// and composables/useDateAxisState.ts once Gantt is feature-frozen.
// Bug-fix discipline: until then, any fix applied here MUST be double-applied to the
// Timeline counterpart (and vice versa). See plan.md Phase 4 "Consolidation pass".

import type { GanttType, TableType, ViewType } from 'nocodb-sdk'
import type { ComputedRef } from 'vue'

const [useProvideGanttViewStore, useGanttViewStore] = useInjectionState(
  (
    _meta: Ref<TableType | undefined>,
    _viewMeta: Ref<(ViewType | GanttType | undefined) & { id: string }>,
    _shared?: boolean,
    _where?: ComputedRef<string | undefined>,
  ) => {
    return {
      zoomLevel: ref<'day' | 'week' | 'month'>('week'),
      currentDate: ref(''),
      selectedDate: ref(null),
      formattedData: ref<any[]>([]),
      isGanttDataLoading: ref(false),
      searchQuery: ref(''),
      ganttMetaData: ref({}),
      viewMetaProperties: computed(() => ({})),
      ganttRange: computed(() => []),
      visibleDates: computed(() => []),
      dateRangeLabel: computed(() => ''),
      isPublic: ref(false),
      totalRecordCount: ref(0),
      updateFormat: computed(() => ''),
      updateRowProperty: async (..._args: any[]) => {},
      loadGanttData: async () => {},
      navigateToClosestRecord: () => {},
      navigateNext: () => {},
      navigatePrev: () => {},
      goToToday: () => {},
      goToDate: (_date: any) => {},
      setZoomLevel: (_zoom: string) => {},
    }
  },
  'gantt-view-store',
)

export { useProvideGanttViewStore }

export function useGanttViewStoreOrThrow() {
  const store = useGanttViewStore()
  if (!store) throw new Error('Gantt view store is not provided')
  return store
}

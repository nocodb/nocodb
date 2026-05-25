// TEMPORARY CLONE — duplicated from Timeline/useTimelineViewStore on 2026-04-24.
// Rename pass: timeline → gantt. To be consolidated into components/smartsheet/shared/
// and composables/useDateAxisState.ts once Gantt is feature-frozen.
// Bug-fix discipline: until then, any fix applied here MUST be double-applied to the
// Timeline counterpart (and vice versa). See plan.md Phase 4 "Consolidation pass".
//
// This is the CE stub — Gantt view is EE-only, so no CE component actually
// renders against this store. The stub exists so the EE store's surface can
// be type-resolved at build time and so any future CE consumer destructuring
// gets safe no-op defaults instead of `undefined`. Keep the keys in this
// `return {}` aligned with the EE implementation's `return {}` (search for
// `ee/composables/useGanttViewStore.ts`).

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
      // Axis state (from shared date-axis composable in EE)
      zoomLevel: ref<'day' | 'week' | 'month'>('week'),
      currentDate: ref(''),
      selectedDate: ref(null),
      bufferStart: ref(null),
      bufferEnd: ref(null),
      scrollLeft: ref(0),
      viewportWidth: ref(0),
      colWidth: ref(0),
      visibleDates: computed(() => []),
      totalGridWidth: ref(0),
      gridlineOffsets: computed(() => []),
      weekendOffsets: computed(() => []),
      minorLabels: computed(() => []),
      majorHeaderTiers: computed(() => []),
      dateRangeLabel: computed(() => ''),
      allowedZoomLevels: computed(() => []),

      // Gantt-specific state
      formattedData: ref<any[]>([]),
      isGanttDataLoading: ref(false),
      searchQuery: ref(''),
      ganttMetaData: ref({}),
      viewMetaProperties: computed(() => ({})),
      ganttRange: computed(() => []),
      isPublic: ref(false),
      totalRecordCount: ref(0),
      dependencyLinks: ref(new Map<string, string[]>()),
      cycleEdgeIds: computed(() => new Set<string>()),
      invalidReasonFor: (..._args: any[]) => null,
      invalidDependencyCount: computed(() => 0),
      updateFormat: computed(() => ''),
      inspectorRecord: ref(null),

      // Axis methods
      reAnchorBuffer: (..._args: any[]) => {},
      requestScrollToDate: (..._args: any[]) => {},
      onScrollUpdate: (..._args: any[]) => {},
      setViewportWidth: (..._args: any[]) => {},
      onScrollAdjustment: (..._args: any[]) => {},
      goToDate: (..._args: any[]) => {},
      goToToday: () => {},
      navigateNext: () => {},
      navigatePrev: () => {},
      setZoomLevel: (..._args: any[]) => {},

      // Gantt-specific methods
      loadGanttData: async () => {},
      loadMoreGanttRecords: async () => {},
      hasMoreRecords: ref(false),
      loadDependencyLinks: async () => {},
      unlinkDependency: async (..._args: any[]) => false,
      linkDependency: async (..._args: any[]) => false,
      navigateToClosestRecord: () => {},
      updateRowProperty: async (..._args: any[]) => {},
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

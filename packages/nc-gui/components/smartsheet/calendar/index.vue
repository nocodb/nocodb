<script lang="ts" setup>
import { type ColumnType, PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { user, isMobileMode } = useGlobal()

const { isAllowed } = usePermissions()

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

// Calendar date cells render lookup fields through the flat PlainCell path,
// which only reads the metas cache. Preload the related-table metas for every
// visible lookup chain so a lookup-of-a-lookup resolves on a direct URL /
// refresh — without it those cells render empty or as "[object Object]".
useLoadLookupMetas(meta, { enabled: computed(() => !isPublic.value) })

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const { allFilters, validFiltersFromUrlParams } = useSmartsheetStoreOrThrow()
const {
  activeCalendarView, // The active Calendar View - "week" | "day" | "month" | "year"
  calendarRange, // calendar Ranges
  calDataType, // Calendar Data Type
  loadCalendarData, // Function to load Calendar Data
  loadSidebarData, // Function to load Sidebar Data
  isCalendarDataLoading, // Boolean ref to check if Calendar Data is Loading
  fetchActiveDates, // Function to fetch Active Dates
  showSideMenu, // Boolean Ref to show Side Menu
  recordHeightMode, // 'compact' (default) | 'expanded'
  isDayAnchoredMode, // '3day' or custom + day-unit → WeekView with N day columns
  isMultiWeekRange, // 2week / 6week / custom + week-unit → MonthView with N week rows
} = useCalendarViewStoreOrThrow()

// In Expanded mode the week/multi-week and month grids grow beyond the viewport to show
// every record, so the calendar body becomes the vertical scroll container.
const isHeightExpanded = computed(
  () =>
    recordHeightMode.value === 'expanded' &&
    ['week', '3day', '2week', 'month', '6week', 'custom'].includes(activeCalendarView.value),
)

// On a phone the multi-column modes squeeze day-columns to ~50px and event text becomes
// unreadable. Give the grid a per-mode minimum width so columns stay legible and let the
// body scroll horizontally instead of collapsing. Day and Year keep the full viewport width.
const gridMinWidth = computed(() => {
  if (!isMobileMode.value) return 0
  switch (activeCalendarView.value) {
    case 'week':
    case 'month':
    case '2week':
    case '6week':
      return 700
    case '3day':
      return 460
    default:
      return 0
  }
})

const isGridScroll = computed(() => gridMinWidth.value > 0)

// When the full-screen record sidebar is open on a phone the calendar body collapses to 0
// width; without clipping, its overflowing day-numbers bleed through the sidebar's edges.
const isMobileSidebarOpen = computed(() => isMobileMode.value && showSideMenu.value)

// Viewport-bounded height of the calendar body. Stays the visible height even when the
// grid grows and scrolls, so Month/multi-week can use it as the compact (minimum) row
// height in Expanded mode. Provided to the view components.
const calendarBody = ref<HTMLElement>()

const { height: calendarBodyHeight } = useElementSize(calendarBody)

provide('calendarBodyHeight', calendarBodyHeight)

// The scroll container for the expanded (grid-grows-and-scrolls) views. Provided so Month/Week
// can window their records to the visible band instead of rendering every lane on a dense day.
provide('calendarScrollContainer', calendarBody)

const router = useRouter()

const route = useRoute()

const { withLoading } = useLoadingTrigger()

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(value) {
    if (!value) {
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
    }
  },
})

const expandedFormDlg = ref(false)

const expandedFormRow = ref<RowType>()

const expandedFormRowState = ref<Record<string, any>>()

const expandRecord = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  expandedFormRowState.value = state

  if (rowId && !isPublic.value) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
  }
}

const newRecord = (row: RowType) => {
  if (isPublic.value || (meta.value?.id && !isAllowed(PermissionEntity.TABLE, meta.value?.id, PermissionKey.TABLE_RECORD_ADD))) {
    return
  }

  $e('c:calendar:new-record', activeCalendarView.value)

  const rowFilters = getPlaceholderNewRow(
    [...allFilters.value, ...validFiltersFromUrlParams.value],
    meta.value?.columns as ColumnType[],
    {
      currentUser: user.value ?? undefined,
    },
  )

  expandRecord({
    row: {
      ...rowDefaultData(meta.value?.columns, user.value ?? undefined),
      ...rowFilters,
      ...row.row,
    },
    oldRow: {},
    rowMeta: {
      new: true,
    },
  })
}

onMounted(async () => {
  await Promise.all([loadCalendarData(), loadSidebarData(), fetchActiveDates()])
  if (!activeCalendarView.value) {
    activeCalendarView.value = 'month'
  }
})

const reloadViewDataListener = withLoading(async (params: void | { shouldShowLoading?: boolean }) => {
  await Promise.all([
    loadCalendarData(params?.shouldShowLoading ?? false),
    loadSidebarData(params?.shouldShowLoading ?? false),
    fetchActiveDates(),
  ])
})

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataHook?.off(reloadViewDataListener)
})

// on filter param changes reload the data
// In calendar view we don't have toolbar search component, so we have to listen to route query changes to reload the data
watch(
  () => route?.query?.where,
  () => {
    reloadViewDataHook?.trigger()
  },
)
</script>

<template>
  <div class="nc-calendar-container flex flex-col h-full">
    <div class="flex h-full relative flex-row" data-testid="nc-calendar-wrapper">
      <div
        ref="calendarBody"
        class="flex flex-col w-full min-h-0 min-w-0"
        :class="{
          'overflow-y-auto nc-scrollbar-md': isHeightExpanded && !isMobileSidebarOpen,
          'nc-scrollbar-x-md': isGridScroll && !isMobileSidebarOpen,
          '!overflow-hidden': isMobileSidebarOpen,
        }"
      >
        <div class="flex flex-col h-full w-full" :style="isGridScroll ? { minWidth: `${gridMinWidth}px` } : undefined">
          <template v-if="calendarRange?.length">
            <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" />
            <template v-if="!isCalendarDataLoading">
              <LazySmartsheetCalendarMonthView
                v-if="activeCalendarView === 'month' || isMultiWeekRange"
                @expand-record="expandRecord"
                @new-record="newRecord"
              />

              <LazySmartsheetCalendarWeekViewDateField
                v-else-if="(activeCalendarView === 'week' || isDayAnchoredMode) && calDataType === UITypes.Date"
                @expand-record="expandRecord"
                @new-record="newRecord"
              />
              <LazySmartsheetCalendarWeekViewDateTimeField
                v-else-if="
                  (activeCalendarView === 'week' || isDayAnchoredMode) &&
                  [UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.Formula].includes(calDataType)
                "
                @expand-record="expandRecord"
                @new-record="newRecord"
              />
              <LazySmartsheetCalendarDayViewDateField
                v-else-if="activeCalendarView === 'day' && calDataType === UITypes.Date"
                @expand-record="expandRecord"
                @new-record="newRecord"
              />
              <LazySmartsheetCalendarDayViewDateTimeField
                v-else-if="
                  activeCalendarView === 'day' &&
                  [UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime, UITypes.Formula].includes(calDataType)
                "
                @expand-record="expandRecord"
                @new-record="newRecord"
              />
            </template>

            <div
              v-if="isCalendarDataLoading && activeCalendarView !== 'year'"
              class="flex w-full items-center h-full justify-center"
            >
              <GeneralLoader size="xlarge" />
            </div>
          </template>
          <template v-else>
            <div class="flex w-full items-center h-full justify-center">
              {{ $t('activity.noRange') }}
            </div>
          </template>
        </div>
      </div>
      <Transition>
        <LazySmartsheetCalendarSideMenu
          v-show="showSideMenu"
          :visible="showSideMenu"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
      </Transition>
    </div>

    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :row="expandedFormRow"
        :load-row="!isPublic"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
      />
    </Suspense>

    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      close-after-save
      :load-row="!isPublic"
      :meta="meta"
      :state="expandedFormRowState"
      :row="{
        row: {},
        oldRow: {},
        rowMeta: {},
      }"
      :row-id="route.query.rowId"
      :expand-form="expandRecord"
      :view="view"
    />
  </div>
</template>

<style scoped lang="scss">
.v-enter-from,
.v-leave-to {
  transform: translateX(200%);
}

.v-enter-to,
.v-leave-from {
  transform: translateX(100%);
}
</style>

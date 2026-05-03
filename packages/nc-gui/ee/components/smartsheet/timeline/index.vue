<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Row as RowType } from '#imports'
import type { TimelineZoomLevel } from '../../../utils/timelineUtils'
import { TIMELINE_ZOOM_LEVELS } from '../../../utils/timelineUtils'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const { $e } = useNuxtApp()

const isPublic = inject(IsPublicInj, ref(false))

const { t } = useI18n()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

// When the left sidebar is open, show toolbar buttons as icon-only with tooltips
const isToolbarIconMode = computed(() => isLeftSidebarOpen.value)

provide(IsToolbarIconMode, isToolbarIconMode)
provide(IsFormInj, ref(false))
provide(IsGalleryInj, ref(false))
provide(IsGridInj, ref(false))
provide(IsKanbanInj, ref(false))
provide(IsCalendarInj, ref(false))
provide(IsTimelineInj, ref(true))

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const {
  timelineRange,
  formattedData,
  isTimelineDataLoading,
  loadTimelineData,
  visibleDates,
  dateRangeLabel,
  zoomLevel,
  navigateNext,
  navigatePrev,
  goToToday,
  goToDate,
  setZoomLevel,
  currentDate,
  totalRecordCount,
  recordsWithoutDates,
  navigateToClosestRecord,
  updateFormat,
  colWidth,
  totalGridWidth,
  scrollLeft: storeScrollLeft,
  setViewportWidth,
  onScrollUpdate,
  majorHeaderTiers,
  gridlineOffsets,
  weekendOffsets,
  minorLabels,
} = useTimelineViewStoreOrThrow()


const zoomOptions = TIMELINE_ZOOM_LEVELS

const zoomLabel = (option: TimelineZoomLevel) => {
  if (option === '2week') return t('objects.twoWeek')
  if (option === '6month') return t('objects.sixMonth')
  if (option === '2year') return t('objects.twoYear')
  if (option === '5year') return t('objects.fiveYear')
  return t(`objects.${option}`)
}

// Group-by support (provided by parent Smartsheet.vue via useProvideViewGroupBy)
const { isGroupBy, rootGroup, groupBy, loadGroups, loadGroupData, loadGroupPage, groupWrapperChangePage } =
  useViewGroupByOrThrow()

const { isViewDataLoading, isPaginationLoading } = storeToRefs(useViewsStore())

const router = useRouter()
const route = useRoute()

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

  $e('a:timeline:expand-record')

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

// #12: Create a new record with pre-filled start/end dates from drag-to-create
const onNewRecord = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) => {
  const range = timelineRange.value?.[0]
  if (!range?.fk_from_col?.title) return

  $e('c:timeline:new-record', { zoomLevel: zoomLevel.value })

  const row: Record<string, any> = {
    [range.fk_from_col.title]: startDate.format(updateFormat.value),
  }
  if (range.fk_to_col?.title) {
    row[range.fk_to_col.title] = endDate.format(updateFormat.value)
  }

  expandRecord({ row, oldRow: {}, rowMeta: { new: true } })
}

// Floating "+" button — create a new record with start date set to the median visible date
const onFloatingNewRecord = () => {
  const range = timelineRange.value?.[0]
  if (!range?.fk_from_col?.title) return

  const midIdx = Math.floor(visibleDates.value.length / 2)
  const medianDate = visibleDates.value[midIdx] ?? visibleDates.value[0]
  if (!medianDate) return

  const row: Record<string, any> = {
    [range.fk_from_col.title]: medianDate.format(updateFormat.value),
  }
  if (range.fk_to_col?.title) {
    row[range.fk_to_col.title] = medianDate.format(updateFormat.value)
  }

  expandRecord({ row, oldRow: {}, rowMeta: { new: true } })
}

const reloadData = async () => {
  if (isGroupBy.value) {
    isViewDataLoading.value = true
    isPaginationLoading.value = true
    try {
      await loadGroups({}, rootGroup.value)
    } finally {
      isViewDataLoading.value = false
      isPaginationLoading.value = false
    }
  } else {
    await loadTimelineData()
  }
}

onMounted(async () => {
  await reloadData()
  navigateToClosestRecord()
})

const reloadViewDataListener = async () => {
  await reloadData()
}

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataHook?.off(reloadViewDataListener)
})

// Reload only on timelineRange change. The data fetch is scale-independent
// (400 records, no date filter), so reloading on zoomLevel is wasteful — and
// worse, the loading flip unmounts the Grid via v-else-if, which loses the
// DOM scrollLeft we just projected for the new scale and leaves the new Grid
// scrolled to 0. timelineRange is critical: it may be empty on mount
// (view data loads async) and gets populated later when
// activeView.view.timeline_range arrives.
watch(timelineRange, () => {
  reloadData()
})

// When group-by is toggled on/off, reload with appropriate strategy
watch(isGroupBy, () => {
  reloadData()
})

// When group-by fields change, reload data
watch(
  groupBy,
  () => {
    if (isGroupBy.value) {
      reloadData()
    }
  },
  { deep: true },
)

// --- Shared date header for grouped layout ---
const GROUP_SIDEBAR_WIDTH = TIMELINE_GROUP_SIDEBAR_WIDTH
const GROUP_HEADER_HEIGHT = TIMELINE_GROUP_HEADER_HEIGHT
const groupHeaderRef = ref<HTMLElement | null>(null)
const { width: groupHeaderWidth } = useElementSize(groupHeaderRef)

// Surface viewport width to the store from the grouped header — scroll math
// (centring on a date, edge-extension thresholds) needs the visible width.
// In flat mode Grid.vue does the same from its own container.
watch(groupHeaderWidth, (w) => {
  if (w > 0) setViewportWidth(w)
}, { immediate: true })

// Mirror store scrollLeft into the grouped header so it follows when a per-group
// body scrolls. `flush: sync` keeps the header lockstep with the body during
// user scrolling.
watch(
  () => storeScrollLeft.value,
  (newLeft) => {
    if (groupHeaderRef.value && groupHeaderRef.value.scrollLeft !== newLeft) {
      groupHeaderRef.value.scrollLeft = newLeft
    }
  },
  { flush: 'sync' },
)

// User scrolls the date header — push position into the store so all the
// per-group bodies follow.
const onGroupHeaderScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target.scrollLeft === storeScrollLeft.value) return
  onScrollUpdate(target.scrollLeft)
}

// Label for the "Grouped by" sidebar header
const groupByFieldLabel = computed(() => {
  if (!groupBy.value?.length) return ''
  if (groupBy.value.length > 1) return t('msg.timelineGroupByFields', { count: groupBy.value.length })
  return groupBy.value[0]?.column?.title || ''
})

// #18: Reactive today
const today = ref(dayjs())

// Today's column index (relative to bufferStart) — drives the today
// highlight overlay in the grouped header without a per-day cell.
const todayDayIdx = computed(() => {
  const firstDate = visibleDates.value[0]
  if (!firstDate) return -1
  const offset = today.value.diff(firstDate, 'day')
  if (offset < 0 || offset >= visibleDates.value.length) return -1
  return offset
})

// #7: Date picker dropdown
const datePickerVisible = ref(false)
const pageDate = ref(dayjs())

// Keep pageDate in sync with currentDate when navigating
watch(currentDate, (val) => {
  pageDate.value = val
})

const onDatePickerSelect = (date: dayjs.Dayjs) => {
  goToDate(date)
  datePickerVisible.value = false
  $e('c:timeline:date-picker', { zoomLevel: zoomLevel.value })
}

// #3: Record count badge text
const recordCountLabel = computed(() => {
  const total = totalRecordCount.value
  const noDate = recordsWithoutDates.value
  if (noDate > 0) {
    return t('msg.timelineRecordsCountWithMissing', { total, noDate })
  }
  return total > 0 ? t('msg.timelineRecordsCount', { total }) : ''
})

// Date-picker button width per zoom level. Wider scales need less space
// (just a year/quarter label); finer scales need a full date.
const dateButtonWidthClass: Record<TimelineZoomLevel, string> = {
  day: 'w-48',
  week: 'w-38',
  '2week': 'w-38',
  month: 'w-29',
  quarter: 'w-29',
  '6month': 'w-29',
  year: 'w-29',
  '2year': 'w-29',
  '5year': 'w-29',
}
</script>

<template>
  <template v-if="isMobileMode">
    <div class="pl-6 pr-[120px] py-6 bg-nc-bg-default flex-col justify-start items-start gap-2.5 inline-flex">
      <div class="text-nc-content-gray-muted text-5xl font-semibold leading-16">
        {{ $t('labels.availableInDesktop') }}
      </div>
      <div class="text-nc-content-gray-muted text-base font-medium leading-normal">
        {{ $t('msg.timelineViewNotSupportedOnMobile') }}
      </div>
    </div>
  </template>
  <template v-else>
    <!-- Lets not support rtl for now as its not handled in the component -->
    <div dir="ltr" class="relative flex flex-col h-full w-full bg-nc-bg-default" data-testid="nc-timeline-wrapper">
      <!-- Toolbar -->
      <div
        class="nc-timeline-toolbar flex items-center gap-1 px-3 border-b border-nc-border-gray-medium bg-nc-bg-default min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)]"
      >
        <!-- #7: Date Header with picker dropdown -->
        <NcDropdown v-model:visible="datePickerVisible" :trigger="['click']">
          <NcButton
            :class="[dateButtonWidthClass[zoomLevel], 'nc-timeline-prev-next-btn !h-7']"
            full-width
            size="small"
            type="secondary"
          >
            <div class="flex w-full px-1 items-center justify-between">
              <span
                :class="{
                  'max-w-38 truncate': zoomLevel === 'week' || zoomLevel === '2week',
                }"
                class="font-medium text-[13px] text-center text-nc-content-gray"
                data-testid="nc-timeline-active-date"
              >
                {{ dateRangeLabel }}
              </span>
              <GeneralIcon icon="arrowDown" class="ml-1 text-nc-content-gray-subtle" />
            </div>
          </NcButton>
          <template #overlay>
            <div v-if="datePickerVisible" class="w-[287px] pb-2" @click.stop>
              <NcDateWeekSelector
                v-if="zoomLevel === 'week' || zoomLevel === '2week'"
                v-model:page-date="pageDate"
                :selected-date="currentDate"
                is-week-picker
                header="v2"
                size="medium"
                @update:selected-date="onDatePickerSelect"
              />
              <NcDateWeekSelector
                v-else-if="zoomLevel === 'day'"
                v-model:page-date="pageDate"
                :selected-date="currentDate"
                header="v2"
                size="medium"
                @update:selected-date="onDatePickerSelect"
              />
              <NcMonthYearSelector
                v-else
                v-model:page-date="pageDate"
                :selected-date="currentDate"
                header="v2"
                size="medium"
                @update:selected-date="onDatePickerSelect"
              />
            </div>
          </template>
        </NcDropdown>

        <!-- Today Button -->
        <NcButton
          v-e="['c:timeline:today-btn']"
          class="nc-timeline-prev-next-btn !h-7"
          size="small"
          type="secondary"
          data-testid="nc-timeline-today-btn"
          @click="goToToday"
        >
          <span class="text-nc-content-gray-subtle font-medium !text-[13px]">
            {{ $t('labels.today') }}
          </span>
        </NcButton>

        <!-- Prev/Next Navigation -->
        <div class="flex items-center gap-2">
          <NcTooltip hide-on-click>
            <template #title>{{ $t('labels.previous') }}</template>
            <NcButton
              v-e="['c:timeline:navigate', { direction: 'prev' }]"
              class="!w-7 !h-7 !rounded-lg nc-timeline-prev-next-btn !hover:(text-nc-content-gray-subtle)"
              inner-class="flex items-center justify-center"
              data-testid="nc-timeline-prev-btn"
              size="xs"
              type="text"
              @click="navigatePrev"
            >
              <GeneralIcon icon="ncChevronLeft" class="h-4 !-ml-0.5 w-4" />
            </NcButton>
          </NcTooltip>
          <NcTooltip hide-on-click>
            <template #title>{{ $t('labels.next') }}</template>
            <NcButton
              v-e="['c:timeline:navigate', { direction: 'next' }]"
              class="!w-7 !h-7 !rounded-lg nc-timeline-prev-next-btn !hover:(text-nc-content-gray-subtle)"
              inner-class="flex items-center justify-center"
              data-testid="nc-timeline-next-btn"
              size="xs"
              type="text"
              @click="navigateNext"
            >
              <GeneralIcon icon="ncChevronRight" class="h-4 !-ml-0.2 w-4" />
            </NcButton>
          </NcTooltip>
        </div>

        <!-- #3 + #15: Record count badge -->
        <NcTooltip
          v-if="recordCountLabel && !isGroupBy"
          class="ml-1 text-[11px] text-nc-content-gray-muted font-medium px-1.5 py-0.5 rounded-md bg-nc-bg-gray-medium truncate"
          :class="{ 'text-nc-content-orange-medium bg-nc-bg-orange-light': recordsWithoutDates > 0 }"
          data-testid="nc-timeline-record-count"
        >
          <template #title>
            <span v-if="recordsWithoutDates > 0">
              {{ $t('msg.timelineRecordsMissingDates', { count: recordsWithoutDates }, recordsWithoutDates) }}
            </span>
            <span v-else>{{ $t('msg.timelineTotalRecordsLoaded', { max: 400 }) }}</span>
          </template>

          {{ recordCountLabel }}
        </NcTooltip>

        <div class="flex-1" />

        <!-- Zoom Mode Selector (day, week, month, quarter, year, 5-year) -->
        <a-select
          v-e="['c:timeline:change-zoom-level']"
          :value="zoomLevel"
          class="nc-select-shadow nc-timeline-mode-select !w-24 !rounded-lg"
          dropdown-class-name="nc-timeline-zoom-dropdown !rounded-lg !min-w-28"
          :list-height="320"
          size="small"
          data-testid="nc-timeline-view-mode"
          @change="setZoomLevel"
          @click.stop
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="option in zoomOptions" :key="option" :value="option">
            <div class="w-full flex gap-2 items-center justify-between" :title="zoomLabel(option)">
              <div class="flex items-center gap-1">
                <NcTooltip class="flex-1 capitalize truncate" show-on-truncate-only>
                  <template #title>{{ zoomLabel(option) }}</template>
                  <template #default>{{ zoomLabel(option) }}</template>
                </NcTooltip>
              </div>
              <GeneralIcon
                v-if="option === zoomLevel"
                id="nc-selected-item-icon"
                icon="check"
                class="flex-none text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>

        <!-- Fields -->
        <SmartsheetToolbarFieldsMenu v-if="!isPublic" :show-system-fields="false" />

        <!-- #8: Sort -->
        <LazySmartsheetToolbarSortListMenu v-if="!isPublic" />

        <!-- Group By -->
        <SmartsheetToolbarGroupByMenu v-if="!isPublic" hide-reorder />

        <!-- Colour -->
        <SmartsheetToolbarRowColorFilterDropdown v-if="!isPublic" />

        <!-- Filter -->
        <SmartsheetToolbarColumnFilterMenu v-if="!isPublic" />

        <!-- Timeline Settings (#5: using timeline icon instead of calendar) -->
        <SmartsheetToolbarTimelineRange />

        <!-- Actions menu (three-dot) -->
        <SmartsheetToolbarOpenedViewAction />
      </div>

      <!-- Timeline content -->
      <template v-if="timelineRange?.length">
        <div v-if="isTimelineDataLoading" class="flex-1 flex w-full items-center justify-center min-h-0">
          <GeneralLoader size="xlarge" />
        </div>

        <!-- Grouped layout: fixed header (sidebar + dates) + scrollable groups -->
        <div v-else-if="isGroupBy" class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <!-- Fixed header row: left sidebar header + date columns -->
          <div class="flex flex-shrink-0 border-b border-nc-border-gray-medium">
            <!-- Left sidebar header: "Grouped by <field>" -->
            <div
              class="flex-shrink-0 border-r border-nc-border-gray-medium bg-nc-bg-default px-3 flex items-center"
              :style="{ width: `${GROUP_SIDEBAR_WIDTH}px`, height: `${GROUP_HEADER_HEIGHT}px` }"
            >
              <span class="text-[11px] text-nc-content-gray-muted font-normal truncate">{{ groupByFieldLabel }}</span>
            </div>

            <!-- Date columns header — the shared horizontal scrollbar for grouped mode lives here.
                 Per-group bodies have hidden scrollbars and follow this one via the store. -->
            <div ref="groupHeaderRef" class="flex-1 overflow-x-auto overflow-y-hidden" @scroll="onGroupHeaderScroll">
              <div :style="{ width: `${totalGridWidth}px` }">
                <!-- Stacked major rows -->
                <div
                  v-for="(tier, tierIdx) in majorHeaderTiers"
                  :key="`tier-${tierIdx}`"
                  class="relative bg-nc-bg-default border-b border-nc-border-gray-light"
                  :style="{ height: '20px' }"
                >
                  <div
                    v-for="span in tier"
                    :key="span.key"
                    class="absolute top-0 h-full flex items-center justify-start text-[11px] font-medium text-nc-content-gray-emphasis border-r border-nc-border-gray-light overflow-hidden whitespace-nowrap px-2"
                    :style="{ left: `${span.leftPx}px`, width: `${span.widthPx}px` }"
                  >
                    {{ span.label }}
                  </div>
                </div>

                <!-- Minor row — bg div + sparse overlays so coarse zooms
                     don't iterate 1.5k–3.7k cells per scroll. -->
                <div
                  class="relative bg-nc-bg-default"
                  :style="{ height: `${GROUP_HEADER_HEIGHT}px`, width: `${totalGridWidth}px` }"
                >
                  <div
                    v-for="off in weekendOffsets"
                    :key="`gwk-${off.key}`"
                    class="absolute top-0 bottom-0 bg-nc-bg-gray-extralight pointer-events-none"
                    :style="{ left: `${off.leftPx}px`, width: `${colWidth}px` }"
                  />
                  <div
                    v-if="todayDayIdx >= 0"
                    class="absolute top-0 bottom-0 bg-nc-bg-brand pointer-events-none"
                    :style="{ left: `${todayDayIdx * colWidth}px`, width: `${colWidth}px` }"
                  />
                  <div
                    v-for="off in gridlineOffsets"
                    :key="`ggl-${off.key}`"
                    class="absolute top-0 bottom-0 border-r border-nc-border-gray-light pointer-events-none"
                    :style="{ left: `${off.leftPx}px` }"
                  />
                  <div
                    v-for="lbl in minorLabels"
                    :key="`gl-${lbl.key}`"
                    class="absolute top-0 bottom-0 flex flex-col items-center justify-center pointer-events-none"
                    :style="{ left: `${lbl.leftPx}px`, width: `${colWidth}px` }"
                  >
                    <span
                      v-if="lbl.weekday"
                      class="text-[10px] font-normal leading-tight"
                      :class="lbl.idx === todayDayIdx ? 'text-nc-content-brand' : 'text-nc-content-gray-muted'"
                    >
                      {{ lbl.weekday }}
                    </span>
                    <span
                      v-if="lbl.dayNum"
                      class="text-[11px] font-normal leading-tight whitespace-nowrap"
                      :class="lbl.idx === todayDayIdx ? 'text-nc-content-brand' : 'text-nc-content-gray-muted'"
                    >
                      {{ lbl.dayNum }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Scrollable groups area -->
          <SmartsheetTimelineGroupBy
            class="flex-1 min-h-0"
            :group="rootGroup"
            :visible-dates="visibleDates"
            :timeline-range="timelineRange"
            :zoom-level="zoomLevel"
            :load-groups="loadGroups"
            :load-group-data="loadGroupData"
            :load-group-page="loadGroupPage"
            :group-wrapper-change-page="groupWrapperChangePage"
            :max-depth="groupBy.length"
            @expand-record="expandRecord"
            @navigate-to="goToDate"
          />
        </div>

        <!-- Flat layout (no group-by) -->
        <SmartsheetTimelineGrid
          v-else
          class="flex-1 min-h-0"
          :records="formattedData"
          :visible-dates="visibleDates"
          :timeline-range="timelineRange"
          :zoom-level="zoomLevel"
          @expand-record="expandRecord"
          @new-record="onNewRecord"
          @navigate-to="goToDate"
        />
      </template>
      <!-- #9: Empty state — using i18n -->
      <template v-else>
        <div class="flex-1 flex w-full items-center justify-center text-nc-content-gray-muted min-h-0 flex-col gap-2">
          <GeneralIcon icon="warning" class="text-2xl text-nc-content-orange-medium" />
          <span class="text-sm">{{ $t('activity.noTimelineRange') }}</span>
          <span class="text-xs text-nc-content-gray-subtle">{{ $t('msg.configureTimelineRange') }}</span>
        </div>
      </template>

      <!-- Floating new record button -->
      <NcTooltip
        v-if="timelineRange?.length && !isPublic"
        class="!absolute left-3 z-20"
        :class="isGroupBy ? 'bottom-13' : 'bottom-3'"
      >
        <template #title>{{ $t('activity.newRecord') }}</template>
        <NcButton
          v-e="['c:timeline:new-record-btn']"
          class="!rounded-full !shadow-sm !w-8 !h-8 !min-w-0 !p-0"
          type="secondary"
          size="small"
          data-testid="nc-timeline-new-record-btn"
          @click="onFloatingNewRecord"
        >
          <GeneralIcon icon="plus" class="text-nc-content-gray-subtle w-4 h-4" />
        </NcButton>
      </NcTooltip>
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
  </template>
</template>

<style lang="scss" scoped>
.nc-timeline-prev-next-btn {
  @apply !hover:bg-nc-bg-gray-medium;
}

.nc-timeline-mode-select {
  :deep(.ant-select-selector) {
    @apply !h-7 !px-3 !flex !items-center;
  }
  :deep(.ant-select-selection-item) {
    @apply !text-[13px] !flex !items-center;
  }
}
</style>

<style lang="scss">
// Teleported dropdown — needs unscoped styles. Match the action menu's
// density: 13px font, 30px row height, no extra vertical padding.
.nc-timeline-zoom-dropdown {
  .ant-select-item {
    @apply !min-h-[30px] !py-1 !px-3 !text-[13px] !leading-tight;
  }
}
</style>

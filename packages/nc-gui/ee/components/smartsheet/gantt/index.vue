<script lang="ts" setup>
import dayjs from 'dayjs'
import type { TimelineZoomLevel } from '../../../utils/timelineUtils'
import type { Row as RowType } from '#imports'

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
provide(IsGanttInj, ref(true))

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const {
  ganttRange,
  formattedData,
  isGanttDataLoading,
  loadGanttData,
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
  allowedZoomLevels,
} = useGanttViewStoreOrThrow()

// Multi-word scale labels go through `t()`; the rest fall back to `objects.<key>`.
const zoomLabel = (option: TimelineZoomLevel) => {
  if (option === '2week') return t('objects.twoWeek')
  if (option === '6month') return t('objects.sixMonth')
  if (option === '2year') return t('objects.twoYear')
  if (option === '5year') return t('objects.fiveYear')
  return t(`objects.${option}`)
}

// Date-picker button width per zoom level. Coarser scales fit short labels
// (just a year / quarter / half-year), so they get a narrower button; finer
// scales need room for a full date.
const dateButtonWidthClass: Record<TimelineZoomLevel, string> = {
  'day': 'w-48',
  'week': 'w-38',
  '2week': 'w-38',
  'month': 'w-29',
  'quarter': 'w-29',
  '6month': 'w-29',
  'year': 'w-29',
  '2year': 'w-29',
  '5year': 'w-29',
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

// Open the table-level Date Dependencies dialog from the empty-state CTA.
const showDateDependencyDlg = ref(false)

const expandRecord = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  expandedFormRowState.value = state

  $e('a:gantt:expand-record')

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
  const range = ganttRange.value?.[0]
  if (!range?.fk_from_col?.title) return

  $e('c:gantt:new-record', { zoomLevel: zoomLevel.value })

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
  const range = ganttRange.value?.[0]
  if (!range?.fk_from_col?.title) return

  $e('c:gantt:new-record-btn', { zoomLevel: zoomLevel.value })

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
    await loadGanttData()
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

// ganttRange is derived from meta.date_dependency; it may be empty on mount
// (meta loads async) and repopulates once the table meta resolves. Gantt does
// a fetch-all (no date filter), so currentDate/zoomLevel changes don't need a
// refetch — only the range definition does. (Pre-buffered-axis we also watched
// currentDate, but currentDate now updates on every scroll event via viewport
// centre tracking, which would create a refetch loop.)
watch(ganttRange, () => {
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

// Surface viewport width to the store from the grouped header — the date-axis
// composable needs the visible width for scroll targets and edge-extension
// thresholds. In flat mode Grid.vue does this from its own container.
watch(
  groupHeaderWidth,
  (w) => {
    if (w > 0) setViewportWidth(w)
  },
  { immediate: true },
)

// Mirror store scrollLeft into the grouped header so the date row follows
// when a per-group body scrolls. `flush: sync` keeps the header lockstep
// with the body during user scrolling.
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
  if (groupBy.value.length > 1) return t('msg.ganttGroupByFields', { count: groupBy.value.length })
  return groupBy.value[0]?.column?.title || ''
})

// #18: Reactive today
const today = ref(dayjs())
const isToday = (date: dayjs.Dayjs) => date.isSame(today.value, 'day')
const isWeekend = (date: dayjs.Dayjs) => date.day() === 0 || date.day() === 6

// Today's column index (relative to bufferStart) — drives the highlight overlay
// in the grouped header without a per-day cell.
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
  $e('c:gantt:date-picker', { zoomLevel: zoomLevel.value })
}

// #3: Record count badge text
const recordCountLabel = computed(() => {
  const total = totalRecordCount.value
  const noDate = recordsWithoutDates.value
  if (noDate > 0) {
    return t('msg.ganttRecordsCountWithMissing', { total, noDate })
  }
  return total > 0 ? t('msg.ganttRecordsCount', { total }) : ''
})
</script>

<template>
  <template v-if="isMobileMode">
    <div class="pl-6 pr-[120px] py-6 bg-nc-bg-default flex-col justify-start items-start gap-2.5 inline-flex">
      <div class="text-nc-content-gray-muted text-5xl font-semibold leading-16">
        {{ $t('labels.availableInDesktop') }}
      </div>
      <div class="text-nc-content-gray-muted text-base font-medium leading-normal">
        {{ $t('msg.ganttViewNotSupportedOnMobile') }}
      </div>
    </div>
  </template>
  <template v-else>
    <!-- Lets not support rtl for now as its not handled in the component -->
    <div dir="ltr" class="relative flex flex-col h-full w-full bg-nc-bg-default" data-testid="nc-gantt-wrapper">
      <!-- Toolbar -->
      <div
        class="nc-gantt-toolbar flex items-center gap-1 px-3 border-b border-nc-border-gray-medium bg-nc-bg-default min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)]"
      >
        <!-- #7: Date Header with picker dropdown -->
        <NcDropdown v-model:visible="datePickerVisible" :trigger="['click']">
          <NcButton
            class="nc-gantt-prev-next-btn !h-7"
            :class="[dateButtonWidthClass[zoomLevel]]"
            full-width
            size="small"
            type="secondary"
          >
            <div class="flex w-full px-1 items-center justify-between">
              <span
                :class="{
                  'max-w-38 truncate': zoomLevel === 'week' || zoomLevel === '2week',
                }"
                class="font-medium text-[13px] leading-normal text-center text-nc-content-gray"
                data-testid="nc-gantt-active-date"
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
                @update:selected-week="(w: { start: dayjs.Dayjs; end: dayjs.Dayjs }) => onDatePickerSelect(w.start)"
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
          v-e="['c:gantt:today-btn']"
          class="nc-gantt-prev-next-btn !h-7"
          size="small"
          type="secondary"
          data-testid="nc-gantt-today-btn"
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
              v-e="['c:gantt:navigate', { direction: 'prev' }]"
              class="!w-7 !h-7 !rounded-lg nc-gantt-prev-next-btn !hover:(text-nc-content-gray-subtle)"
              inner-class="flex items-center justify-center"
              data-testid="nc-gantt-prev-btn"
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
              v-e="['c:gantt:navigate', { direction: 'next' }]"
              class="!w-7 !h-7 !rounded-lg nc-gantt-prev-next-btn !hover:(text-nc-content-gray-subtle)"
              inner-class="flex items-center justify-center"
              data-testid="nc-gantt-next-btn"
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
          data-testid="nc-gantt-record-count"
        >
          <template #title>
            <span v-if="recordsWithoutDates > 0">
              {{ $t('msg.ganttRecordsMissingDates', { count: recordsWithoutDates }, recordsWithoutDates) }}
            </span>
            <span v-else>{{ $t('msg.ganttTotalRecordsLoaded', { max: 400 }) }}</span>
          </template>

          {{ recordCountLabel }}
        </NcTooltip>

        <div class="flex-1" />

        <!-- Zoom Mode Selector: week through 5-year. `allowedZoomLevels` comes
             from the shared date-axis composable (Gantt skips the day scale). -->
        <a-select
          v-e="['c:gantt:change-zoom-level']"
          :value="zoomLevel"
          class="nc-select-shadow nc-gantt-mode-select !w-24 !rounded-lg"
          dropdown-class-name="nc-gantt-zoom-dropdown !rounded-lg !min-w-28"
          :list-height="320"
          size="small"
          data-testid="nc-gantt-view-mode"
          @change="setZoomLevel"
          @click.stop
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="option in allowedZoomLevels" :key="option" :value="option">
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

        <!-- Actions menu (three-dot) -->
        <SmartsheetToolbarOpenedViewAction />
      </div>

      <!-- Gantt content -->
      <template v-if="ganttRange?.length">
        <div v-if="isGanttDataLoading" class="flex-1 flex w-full items-center justify-center min-h-0">
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

            <!-- Date columns header — the shared horizontal scrollbar for grouped mode
                 lives here. Per-group bodies have hidden scrollbars and follow this one
                 via storeScrollLeft. -->
            <div ref="groupHeaderRef" class="flex-1 overflow-x-auto overflow-y-hidden" @scroll="onGroupHeaderScroll">
              <SmartsheetSharedDateAxisHeader
                :major-header-tiers="majorHeaderTiers"
                :minor-labels="minorLabels"
                :weekend-offsets="weekendOffsets"
                :gridline-offsets="gridlineOffsets"
                :col-width="colWidth"
                :total-grid-width="totalGridWidth"
                :today-day-idx="todayDayIdx"
                :minor-height="GROUP_HEADER_HEIGHT"
              />
            </div>
          </div>

          <!-- Scrollable groups area — shared with Timeline; leaf grid supplied via slot. -->
          <SmartsheetSharedDateAxisGroupBy
            class="flex-1 min-h-0"
            :group="rootGroup"
            :load-groups="loadGroups"
            :load-group-data="loadGroupData"
            :load-group-page="loadGroupPage"
            :group-wrapper-change-page="groupWrapperChangePage"
            :max-depth="groupBy.length"
            @expand-record="expandRecord"
            @navigate-to="goToDate"
          >
            <template #default="{ rows }">
              <SmartsheetGanttGrid
                :records="rows"
                :visible-dates="visibleDates"
                :gantt-range="ganttRange"
                :zoom-level="zoomLevel"
                :hide-header="true"
                @expand-record="expandRecord"
                @navigate-to="goToDate"
              />
            </template>
          </SmartsheetSharedDateAxisGroupBy>
        </div>

        <!-- Flat layout (no group-by) -->
        <SmartsheetGanttGrid
          v-else
          class="flex-1 min-h-0"
          :records="formattedData"
          :visible-dates="visibleDates"
          :gantt-range="ganttRange"
          :zoom-level="zoomLevel"
          @expand-record="expandRecord"
          @new-record="onNewRecord"
          @navigate-to="goToDate"
        />
      </template>
      <!-- Empty state — Gantt reads from table-level Date Dependencies.
           If the rule is missing or inactive, prompt the user to open the
           existing table-level dialog instead of offering a per-view config. -->
      <template v-else>
        <div class="flex-1 flex w-full items-center justify-center text-nc-content-gray-muted min-h-0 flex-col gap-3">
          <GeneralIcon icon="warning" class="text-2xl text-nc-content-orange-medium" />
          <span class="text-sm">{{ $t('activity.noGanttRange') }}</span>
          <span class="text-xs text-nc-content-gray-subtle text-center max-w-sm">
            {{ $t('msg.configureGanttRange') }}
          </span>
          <NcButton
            v-if="!isPublic && meta?.id"
            v-e="['c:gantt:open-date-dependency']"
            size="small"
            type="primary"
            data-testid="nc-gantt-open-date-dependency"
            @click="showDateDependencyDlg = true"
          >
            {{ $t('labels.configureDateDependencies') }}
          </NcButton>
        </div>
      </template>

      <DlgTableDateDependency
        v-if="meta?.id"
        v-model:visible="showDateDependencyDlg"
        :table-id="meta.id"
        :title="meta.title"
      />

      <!-- Floating new record button -->
      <NcTooltip
        v-if="ganttRange?.length && !isPublic"
        class="!absolute left-3 z-20"
        :class="isGroupBy ? 'bottom-13' : 'bottom-3'"
      >
        <template #title>{{ $t('activity.newRecord') }}</template>
        <NcButton
          v-e="['c:gantt:new-record-btn']"
          class="!rounded-full !shadow-sm !w-8 !h-8 !min-w-0 !p-0"
          type="secondary"
          size="small"
          data-testid="nc-gantt-new-record-btn"
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
.nc-gantt-prev-next-btn {
  @apply !hover:bg-nc-bg-gray-medium;
}

.nc-gantt-mode-select {
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
.nc-gantt-zoom-dropdown {
  .ant-select-item {
    @apply !min-h-[30px] !py-1 !px-3 !text-[13px] !leading-tight;
  }
}
</style>

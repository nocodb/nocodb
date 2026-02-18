<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Row as RowType } from '#imports'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const isPublic = inject(IsPublicInj, ref(false))

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
  setZoomLevel,
  currentDate,
} = useTimelineViewStoreOrThrow()

// Group-by support (provided by parent Smartsheet.vue via useProvideViewGroupBy)
const {
  isGroupBy,
  rootGroup,
  groupBy,
  loadGroups,
  loadGroupData,
  loadGroupPage,
  groupWrapperChangePage,
} = useViewGroupByOrThrow()

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

const reloadData = async () => {
  if (isGroupBy.value) {
    await loadGroups({}, rootGroup.value)
  } else {
    await loadTimelineData()
  }
}

onMounted(async () => {
  await reloadData()
})

const reloadViewDataListener = async () => {
  await reloadData()
}

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataHook?.off(reloadViewDataListener)
})

// Watch for date/zoom/range changes and reload data
// timelineRange is critical: it may be empty on mount (view data loads async)
// and gets populated later when activeView.view.timeline_range arrives
watch([currentDate, zoomLevel, timelineRange], () => {
  reloadData()
})

// When group-by is toggled on/off, reload with appropriate strategy
watch(isGroupBy, () => {
  reloadData()
})

// --- Shared date header for grouped layout ---
const GROUP_SIDEBAR_WIDTH = TIMELINE_GROUP_SIDEBAR_WIDTH
const GROUP_HEADER_HEIGHT = TIMELINE_GROUP_HEADER_HEIGHT
const groupHeaderRef = ref<HTMLElement | null>(null)
const { width: groupHeaderWidth } = useElementSize(groupHeaderRef)

const groupColWidth = computed(() => {
  if (!groupHeaderWidth.value || !visibleDates.value.length) return 120
  return groupHeaderWidth.value / visibleDates.value.length
})

// Label for the "Grouped by" sidebar header
const groupByFieldLabel = computed(() => {
  if (!groupBy.value?.length) return ''
  if (groupBy.value.length > 1) return `${groupBy.value.length} fields`
  const colId = groupBy.value[0]?.fk_column_id
  if (!colId) return ''
  const col = meta.value?.columns?.find((c) => c.id === colId)
  return col?.title || ''
})

const today = dayjs()
const isToday = (date: dayjs.Dayjs) => date.isSame(today, 'day')
const isWeekend = (date: dayjs.Dayjs) => date.day() === 0 || date.day() === 6
</script>

<template>
  <template v-if="isMobileMode">
    <div class="pl-6 pr-[120px] py-6 bg-nc-bg-default flex-col justify-start items-start gap-2.5 inline-flex">
      <div class="text-nc-content-gray-muted text-5xl font-semibold leading-16">
        Available<br />in Desktop
      </div>
      <div class="text-nc-content-gray-muted text-base font-medium leading-normal">
        Timeline view is not supported on mobile.
      </div>
    </div>
  </template>
  <template v-else>
    <div class="flex flex-col h-full w-full bg-nc-bg-default" data-testid="nc-timeline-wrapper">
      <!-- Toolbar -->
      <div
        class="nc-timeline-toolbar flex items-center gap-1 px-3 border-b border-nc-border-gray-medium bg-nc-bg-default min-h-[var(--toolbar-height)] max-h-[var(--toolbar-height)]"
      >
        <!-- Date Header -->
        <NcButton
          :class="{
            'w-29': zoomLevel === 'month',
            'w-38': zoomLevel === 'week',
          }"
          class="nc-timeline-prev-next-btn !h-7"
          full-width
          size="small"
          type="secondary"
        >
          <div class="flex w-full px-1 items-center justify-between">
            <span
              :class="{
                'max-w-38 truncate': zoomLevel === 'week',
              }"
              class="font-bold text-[13px] text-center text-nc-content-gray"
              data-testid="nc-timeline-active-date"
            >
              {{ dateRangeLabel }}
            </span>
          </div>
        </NcButton>

        <!-- Today Button -->
        <NcButton
          class="nc-timeline-prev-next-btn !h-7"
          size="small"
          type="secondary"
          data-testid="nc-timeline-today-btn"
          @click="goToToday"
        >
          <span class="text-nc-content-gray-subtle font-bold !text-[13px]">
            {{ $t('labels.today') }}
          </span>
        </NcButton>

        <!-- Prev/Next Navigation -->
        <div class="flex items-center gap-2">
          <NcTooltip hide-on-click>
            <template #title>{{ $t('labels.previous') }}</template>
            <NcButton
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

        <div class="flex-1" />

        <!-- Zoom Mode Selector -->
        <a-select
          :value="zoomLevel"
          class="nc-select-shadow nc-timeline-mode-select !w-21 !rounded-lg"
          dropdown-class-name="!rounded-lg !min-w-25"
          size="small"
          data-testid="nc-timeline-view-mode"
          @change="setZoomLevel"
          @click.stop
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
          </template>
          <a-select-option v-for="option in ['week', 'month']" :key="option" :value="option">
            <div class="w-full flex gap-2 items-center justify-between" :title="$t(`objects.${option}`)">
              <div class="flex items-center gap-1">
                <NcTooltip class="flex-1 capitalize mt-0.5 truncate" show-on-truncate-only>
                  <template #title>{{ $t(`objects.${option}`) }}</template>
                  <template #default>{{ $t(`objects.${option}`) }}</template>
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

        <!-- Group By -->
        <SmartsheetToolbarGroupByMenu v-if="!isPublic" />

        <!-- Colour -->
        <SmartsheetToolbarRowColorFilterDropdown v-if="!isPublic" />

        <!-- Filter -->
        <SmartsheetToolbarColumnFilterMenu v-if="!isPublic" />

        <!-- Timeline Settings -->
        <SmartsheetToolbarTimelineRange />
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
              class="flex-shrink-0 border-r border-nc-border-gray-medium bg-nc-bg-default px-3 flex flex-col justify-center"
              :style="{ width: `${GROUP_SIDEBAR_WIDTH}px`, height: `${GROUP_HEADER_HEIGHT}px` }"
            >
              <span class="text-[10px] text-nc-content-gray-muted font-medium uppercase leading-tight">Grouped by</span>
              <span class="text-xs text-nc-content-gray font-semibold truncate">{{ groupByFieldLabel }}</span>
            </div>

            <!-- Date columns header -->
            <div ref="groupHeaderRef" class="flex-1 overflow-hidden">
              <div class="flex bg-nc-bg-default w-full">
                <div
                  v-for="(date, idx) in visibleDates"
                  :key="idx"
                  class="flex-shrink-0 border-r border-nc-border-gray-light flex flex-col items-center justify-center"
                  :class="{
                    'bg-nc-bg-brand': isToday(date),
                    'bg-nc-bg-gray-extralight': isWeekend(date) && !isToday(date),
                  }"
                  :style="{ width: `${groupColWidth}px`, height: `${GROUP_HEADER_HEIGHT}px` }"
                >
                  <span class="text-[10px] font-medium text-nc-content-gray-muted uppercase">
                    {{ date.format('ddd') }}
                  </span>
                  <span
                    class="text-sm font-semibold"
                    :class="{
                      'text-nc-content-brand': isToday(date),
                      'text-nc-content-gray': !isToday(date),
                    }"
                  >
                    {{ date.format('D') }}
                  </span>
                  <span v-if="zoomLevel === 'week'" class="text-[10px] text-nc-content-gray-muted">
                    {{ date.format('MMM') }}
                  </span>
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
        />
      </template>
      <template v-else>
        <div class="flex-1 flex w-full items-center justify-center text-nc-content-gray-muted min-h-0">
          No date range configured. Please set up a date range in the toolbar.
        </div>
      </template>
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
    @apply !h-7 !px-3;
  }
}
</style>

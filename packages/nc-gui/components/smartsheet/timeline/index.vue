<script lang="ts" setup>
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

        <!-- Grouped layout -->
        <SmartsheetTimelineGroupBy
          v-else-if="isGroupBy"
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
        <div class="flex-1 flex w-full items-center justify-center text-gray-500 min-h-0">
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

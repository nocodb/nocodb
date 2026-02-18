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

onMounted(async () => {
  await loadTimelineData()
})

const reloadViewDataListener = async () => {
  await loadTimelineData()
}

reloadViewDataHook?.on(reloadViewDataListener)

onBeforeUnmount(() => {
  reloadViewDataHook?.off(reloadViewDataListener)
})

// Watch for date/zoom/range changes and reload data
// timelineRange is critical: it may be empty on mount (view data loads async)
// and gets populated later when activeView.view.timeline_range arrives
watch([currentDate, zoomLevel, timelineRange], () => {
  loadTimelineData()
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
    <div class="flex flex-col h-full w-full bg-white" data-testid="nc-timeline-wrapper">
      <!-- Toolbar row -->
      <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50">
        <button
          class="px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100"
          :class="{ 'bg-blue-50 border-blue-300 text-blue-700': zoomLevel === 'week' }"
          @click="setZoomLevel('week')"
        >
          Week
        </button>
        <button
          class="px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100"
          :class="{ 'bg-blue-50 border-blue-300 text-blue-700': zoomLevel === 'month' }"
          @click="setZoomLevel('month')"
        >
          Month
        </button>

        <div class="mx-2 h-4 w-px bg-gray-300" />

        <button class="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100" @click="navigatePrev">
          ←
        </button>
        <button class="px-3 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-100" @click="goToToday">
          Today
        </button>
        <button class="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100" @click="navigateNext">
          →
        </button>

        <span class="ml-2 text-sm font-semibold text-gray-700">{{ dateRangeLabel }}</span>

        <div class="flex-1" />

        <SmartsheetToolbarTimelineRange />
      </div>

      <!-- Timeline content -->
      <template v-if="timelineRange?.length">
        <div v-if="isTimelineDataLoading" class="flex-1 flex w-full items-center justify-center min-h-0">
          <GeneralLoader size="xlarge" />
        </div>
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

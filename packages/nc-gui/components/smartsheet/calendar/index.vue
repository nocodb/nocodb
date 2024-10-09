<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const isPublic = inject(IsPublicInj, ref(false))

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const {
  activeCalendarView, // The active Calendar View - "week" | "day" | "month" | "year"
  calendarRange, // calendar Ranges
  calDataType, // Calendar Data Type
  loadCalendarMeta, // Function to load Calendar Meta
  loadCalendarData, // Function to load Calendar Data
  loadSidebarData, // Function to load Sidebar Data
  isCalendarDataLoading, // Boolean ref to check if Calendar Data is Loading
  isCalendarMetaLoading, // Boolean ref to check if Calendar Meta is Loading
  fetchActiveDates, // Function to fetch Active Dates
  showSideMenu, // Boolean Ref to show Side Menu
} = useCalendarViewStoreOrThrow()

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

const newRecord = (row: RowType) => {
  if (isPublic.value) return
  $e('c:calendar:new-record', activeCalendarView.value)
  expandRecord({
    row: {
      ...rowDefaultData(meta.value?.columns),
      ...row.row,
    },
    oldRow: {},
    rowMeta: {
      new: true,
    },
  })
}

onMounted(async () => {
  await loadCalendarMeta()
  await loadCalendarData()
  if (!activeCalendarView.value) {
    activeCalendarView.value = 'month'
  }
})

reloadViewMetaHook?.on(async () => {
  await loadCalendarMeta()
})

reloadViewDataHook?.on(async (params: void | { shouldShowLoading?: boolean }) => {
  await Promise.all([
    loadCalendarData(params?.shouldShowLoading ?? false),
    loadSidebarData(params?.shouldShowLoading ?? false),
    fetchActiveDates(),
  ])
})
</script>

<template>
  <template v-if="isMobileMode">
    <div class="pl-6 pr-[120px] py-6 bg-white flex-col justify-start items-start gap-2.5 inline-flex">
      <div class="text-gray-500 text-5xl font-semibold leading-16">
        {{ $t('general.available') }}<br />{{ $t('title.inDesktop') }}
      </div>
      <div class="text-gray-500 text-base font-medium leading-normal">
        {{ $t('msg.calendarViewNotSupportedOnMobile') }}
      </div>
    </div>
  </template>
  <template v-else>
    <div class="flex h-full relative flex-row" data-testid="nc-calendar-wrapper">
      <div class="flex flex-col w-full">
        <template v-if="calendarRange?.length && !isCalendarMetaLoading">
          <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" />
          <template v-if="!isCalendarDataLoading">
            <LazySmartsheetCalendarMonthView
              v-if="activeCalendarView === 'month'"
              @expand-record="expandRecord"
              @new-record="newRecord"
            />
            <LazySmartsheetCalendarWeekViewDateField
              v-else-if="activeCalendarView === 'week' && calDataType === UITypes.Date"
              @expand-record="expandRecord"
              @new-record="newRecord"
            />
            <LazySmartsheetCalendarWeekViewDateTimeField
              v-else-if="
                activeCalendarView === 'week' &&
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
        <template v-else-if="isCalendarMetaLoading">
          <div class="flex w-full items-center h-full justify-center">
            <GeneralLoader size="xlarge" />
          </div>
        </template>
        <template v-else>
          <div class="flex w-full items-center h-full justify-center">
            {{ $t('activity.noRange') }}
          </div>
        </template>
      </div>
      <LazySmartsheetCalendarSideMenu :visible="showSideMenu" @expand-record="expandRecord" @new-record="newRecord" />
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

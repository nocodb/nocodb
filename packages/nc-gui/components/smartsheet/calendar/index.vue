<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsCalendarInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsKanbanInj,
  MetaInj,
  ReloadViewDataHookInj,
  ReloadViewMetaHookInj,
  type Row as RowType,
  computed,
  extractPkFromRow,
  inject,
  provide,
  ref,
  rowDefaultData,
} from '#imports'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { isMobileMode } = useGlobal()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const {
  calDataType,
  loadCalendarMeta,
  loadCalendarData,
  loadSidebarData,
  isCalendarDataLoading,
  selectedDate,
  selectedMonth,
  activeDates,
  pageDate,
  showSideMenu,
  selectedDateRange,
  activeCalendarView,
  paginateCalendarView,
} = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

const router = useRouter()
const route = useRoute()

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!route.query.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...route.query,
          rowId: undefined,
        },
      })
  },
})

const expandedFormDlg = ref(false)
const expandedFormRow = ref<RowType>()
const expandedFormRowState = ref<Record<string, any>>()

const expandRecord = (row: RowType, state?: Record<string, any>) => {
  const rowId = extractPkFromRow(row.row, meta.value!.columns!)

  if (rowId) {
    router.push({
      query: {
        ...route.query,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormRowState.value = state
    expandedFormDlg.value = true
  }
}

const newRecord = (row: RowType) => {
  // TODO: The default values has to be filled based on the active calendar view
  // and selected sidebar filter option
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
reloadViewDataHook?.on(async () => {
  await Promise.all([loadCalendarData(), loadSidebarData()])
})

const headerText = computed(() => {
  switch (activeCalendarView.value) {
    case 'day':
      return dayjs(selectedDate.value).format('D MMMM YYYY')
    case 'week':
      return `${dayjs(selectedDateRange.value.start).format('D MMM YYYY')} - ${dayjs(selectedDateRange.value.end).format(
        'D MMM YYYY',
      )}`
    case 'month':
      return dayjs(selectedMonth.value).format('MMMM YYYY')
    case 'year':
      return dayjs(selectedDate.value).format('YYYY')
  }
})
</script>

<template>
  <div class="flex h-full flex-row">
    <div class="flex flex-col w-full">
      <div class="flex justify-between p-3 items-center border-b-1 border-gray-200">
        <div class="flex justify-start gap-3 items-center">
          <NcTooltip>
            <template #title> Previous </template>
            <NcButton size="small" type="secondary" @click="paginateCalendarView('prev')">
              <component :is="iconMap.doubleLeftArrow" class="h-4 w-4" />
            </NcButton>
          </NcTooltip>

          <NcDropdown v-model:visible="calendarRangeDropdown" :auto-close="false" :trigger="['click']">
            <NcButton
              :class="{
                'w-36': activeCalendarView === 'month',
                'w-40': activeCalendarView === 'day',
                'w-20': activeCalendarView === 'year',
              }"
              size="small"
              type="secondary"
            >
              <div class="flex gap-2 justify-between items-center">
                <span class="font-bold text-center text-brand-500">{{ headerText }}</span>
                <component :is="iconMap.arrowDown" class="h-4 w-4 text-gray-700" />
              </div>
            </NcButton>

            <template #overlay>
              <div v-if="calendarRangeDropdown" class="min-w-[22.1rem]" @click.stop>
                <NcDateWeekSelector
                  v-if="activeCalendarView === ('day' as const)"
                  v-model:active-dates="activeDates"
                  v-model:page-date="pageDate"
                  v-model:selected-date="selectedDate"
                />
                <NcDateWeekSelector
                  v-else-if="activeCalendarView === ('week' as const)"
                  v-model:active-dates="activeDates"
                  v-model:page-date="pageDate"
                  v-model:selected-week="selectedDateRange"
                  week-picker
                />
                <NcMonthYearSelector
                  v-else-if="activeCalendarView === ('month' as const)"
                  v-model:page-date="pageDate"
                  v-model:selected-date="selectedMonth"
                />
                <NcMonthYearSelector
                  v-else-if="activeCalendarView === ('year' as const)"
                  v-model:page-date="pageDate"
                  v-model:selected-date="selectedDate"
                  year-picker
                />
              </div>
            </template>
          </NcDropdown>
          <NcTooltip>
            <template #title> Next </template>
            <NcButton size="small" type="secondary" @click="paginateCalendarView('next')">
              <component :is="iconMap.doubleRightArrow" class="h-4 w-4" />
            </NcButton>
          </NcTooltip>
          <NcButton
            v-if="!isMobileMode"
            size="small"
            type="secondary"
            @click="
              () => {
                selectedDate = dayjs()
                pageDate = dayjs()
                selectedMonth = dayjs()
                selectedDateRange = {
                  start: dayjs().startOf('week'),
                  end: dayjs().endOf('week'),
                }
              }
            "
          >
            Go to Today
          </NcButton>
        </div>
        <NcTooltip>
          <template #title> Toggle Sidebar </template>
          <NcButton v-if="!isMobileMode" size="small" type="secondary" @click="showSideMenu = !showSideMenu">
            <component :is="iconMap.sidebar" class="h-4 w-4 text-gray-700 transition-all" />
          </NcButton>
        </NcTooltip>
      </div>
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
          v-else-if="activeCalendarView === 'week' && calDataType === UITypes.DateTime"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
        <LazySmartsheetCalendarDayViewDateField
          v-else-if="activeCalendarView === 'day' && calDataType === UITypes.Date"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
        <LazySmartsheetCalendarDayViewDateTimeField
          v-else-if="activeCalendarView === 'day' && calDataType === UITypes.DateTime"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
      </template>
      <div v-if="isCalendarDataLoading && activeCalendarView !== 'year'" class="flex w-full items-center h-full justify-center">
        <GeneralLoader size="xlarge" />
      </div>
    </div>
    <LazySmartsheetCalendarSideMenu
      v-if="!isMobileMode"
      :visible="showSideMenu"
      @expand-record="expandRecord"
      @new-record="newRecord"
    />
  </div>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormRow && expandedFormDlg"
      v-model="expandedFormDlg"
      :meta="meta"
      :row="expandedFormRow"
      :state="expandedFormRowState"
      :view="view"
    />
  </Suspense>

  <Suspense>
    <LazySmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg"
      v-model="expandedFormOnRowIdDlg"
      :meta="meta"
      :row="{ row: {}, oldRow: {}, rowMeta: {} }"
      :row-id="route.query.rowId"
      :view="view"
    />
  </Suspense>
</template>

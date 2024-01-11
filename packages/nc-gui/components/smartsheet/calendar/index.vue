<script lang="ts" setup>
import dayjs from 'dayjs'
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
  useI18n,
} from '#imports'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)
const reloadViewDataHook = inject(ReloadViewDataHookInj)

const { isMobileMode } = useGlobal()

const { t } = useI18n()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const {
  loadCalendarMeta,
  loadCalendarData,
  isCalendarDataLoading,
  selectedDate,
  activeDates,
  pageDate,
  selectedDateRange,
  activeCalendarView,
  paginateCalendarView,
} = useCalendarViewStoreOrThrow()

const showSideMenu = ref(true)

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

const expandRecord = (row: RowType) => {
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
    expandedFormDlg.value = true
  }
}

const newRecord = () => {
  // TODO: The default values has to be filled based on the active calendar view
  // and selected sidebar filter option
  expandRecord({
    row: {
      ...rowDefaultData(meta.value?.columns),
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
  await loadCalendarData()
})
reloadViewDataHook?.on(async () => {
  await loadCalendarData()
})

const headerText = computed(() => {
  switch (activeCalendarView.value) {
    case 'day':
      return dayjs(selectedDate.value).format('D MMMM YYYY')
    case 'week':
      return `${dayjs(selectedDateRange.value.start).format('D MMMM YYYY')} - ${dayjs(selectedDateRange.value.end).format(
        'D MMMM YYYY',
      )}`
    case 'month':
      return dayjs(selectedDate.value).format('MMMM YYYY')
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

          <NcDropdown :auto-close="false">
            <NcButton size="small" type="secondary">
              <div class="flex gap-2 items-center">
                <span class="font-bold text-center text-brand-500">{{ headerText }}</span>
                <component :is="iconMap.arrowDown" class="h-4 w-4 text-gray-700" />
              </div>
            </NcButton>

            <template #overlay>
              <div class="min-w-[22.1rem]">
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
                  v-model:selected-date="selectedDate"
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
                selectedDate = new Date()
                pageDate = new Date()
                selectedDateRange = {
                  start: dayjs(new Date()).startOf('week').toDate(),
                  end: dayjs(new Date()).endOf('week').toDate(),
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
      <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" class="flex-grow-1" />
      <template v-if="!isCalendarDataLoading">
        <LazySmartsheetCalendarMonthView
          v-if="activeCalendarView === 'month'"
          class="flex-grow-1"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
        <LazySmartsheetCalendarWeekView
          v-else-if="activeCalendarView === 'week'"
          class="flex-grow-1"
          @expand-record="expandRecord"
          @new-record="newRecord"
        />
        <LazySmartsheetCalendarDayView
          v-else-if="activeCalendarView === 'day'"
          class="flex-grow-1"
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

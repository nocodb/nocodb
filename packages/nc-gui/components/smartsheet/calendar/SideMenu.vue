<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, iconMap, isRowEmpty, ref } from '#imports'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['expandRecord', 'newRecord'])

const INFINITY_SCROLL_THRESHOLD = 100

const { isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const {
  pageDate,
  displayField,
  selectedDate,
  selectedTime,
  selectedMonth,
  calendarRange,
  selectedDateRange,
  activeDates,
  activeCalendarView,
  isSidebarLoading,
  formattedSideBarData,
  calDataType,
  loadMoreSidebarData,
  searchQuery,
  sideBarFilterOption,
} = useCalendarViewStoreOrThrow()

const sideBarListRef = ref<VNodeRef | null>(null)

const pushToArray = (arr: Array<Row>, record: Row, range) => {
  arr.push({
    ...record,
    rowMeta: {
      ...record.rowMeta,
      range,
    },
  })
}

const dragElement = ref<HTMLElement | null>(null)

const dragStart = (event: DragEvent, record: Row) => {
  dragElement.value = event.target as HTMLElement

  dragElement.value.style.boxShadow = '0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.10)'
  const eventRect = dragElement.value.getBoundingClientRect()

  const initialClickOffsetX = event.clientX - eventRect.left
  const initialClickOffsetY = event.clientY - eventRect.top

  event.dataTransfer?.setData(
    'text/plain',
    JSON.stringify({
      record,
      initialClickOffsetY,
      initialClickOffsetX,
    }),
  )
}

const renderData = computed<Array<Row>>(() => {
  if (!calendarRange.value) return []

  const rangedData: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col
    formattedSideBarData.value.forEach((record) => {
      if (fromCol && toCol) {
        const from = dayjs(record.row[fromCol.title!])
        const to = dayjs(record.row[toCol.title!])
        if (sideBarFilterOption.value === 'withoutDates') {
          if (!from.isValid() || !to.isValid()) {
            pushToArray(rangedData, record, range)
          }
        } else if (sideBarFilterOption.value === 'allRecords') {
          pushToArray(rangedData, record, range)
        } else if (
          sideBarFilterOption.value === 'month' ||
          sideBarFilterOption.value === 'year' ||
          sideBarFilterOption.value === 'selectedDate' ||
          sideBarFilterOption.value === 'selectedHours' ||
          sideBarFilterOption.value === 'week' ||
          sideBarFilterOption.value === 'day'
        ) {
          let fromDate: dayjs.Dayjs | null = null
          let toDate: dayjs.Dayjs | null = null

          switch (sideBarFilterOption.value) {
            case 'month':
              fromDate = dayjs(selectedMonth.value).startOf('month')
              toDate = dayjs(selectedMonth.value).endOf('month')
              break
            case 'year':
              fromDate = dayjs(selectedDate.value).startOf('year')
              toDate = dayjs(selectedDate.value).endOf('year')
              break
            case 'selectedDate':
              fromDate = dayjs(selectedDate.value).startOf('day')
              toDate = dayjs(selectedDate.value).endOf('day')
              break
            case 'week':
              fromDate = dayjs(selectedDateRange.value.start).startOf('week')
              toDate = dayjs(selectedDateRange.value.end).endOf('week')
              break
            case 'day':
              fromDate = dayjs(selectedDate.value).startOf('day')
              toDate = dayjs(selectedDate.value).endOf('day')
              break
            case 'selectedHours':
              fromDate = dayjs(selectedTime.value).startOf('hour')
              toDate = dayjs(selectedTime.value).endOf('hour')
              break
          }

          if (from && to) {
            if (
              (from.isSameOrAfter(fromDate) && to.isSameOrBefore(toDate)) ||
              (from.isSameOrBefore(fromDate) && to.isSameOrAfter(toDate)) ||
              (from.isSameOrBefore(fromDate) && to.isSameOrAfter(fromDate)) ||
              (from.isSameOrBefore(toDate) && to.isSameOrAfter(toDate))
            ) {
              pushToArray(rangedData, record, range)
            }
          }
        }
      } else if (fromCol) {
        const from = dayjs(record.row[fromCol.title!])
        if (sideBarFilterOption.value === 'withoutDates') {
          if (!from.isValid()) {
            pushToArray(rangedData, record, range)
          }
        } else if (sideBarFilterOption.value === 'allRecords') {
          pushToArray(rangedData, record, range)
        } else if (sideBarFilterOption.value === 'selectedDate' || sideBarFilterOption.value === 'day') {
          if (from.isSame(selectedDate.value, 'day')) {
            pushToArray(rangedData, record, range)
          }
        } else if (sideBarFilterOption.value === 'selectedHours') {
          if (from.isSame(selectedTime.value, 'hour')) {
            pushToArray(rangedData, record, range)
          }
        } else if (
          sideBarFilterOption.value === 'week' ||
          sideBarFilterOption.value === 'month' ||
          sideBarFilterOption.value === 'year'
        ) {
          let fromDate: dayjs.Dayjs
          let toDate: dayjs.Dayjs

          switch (sideBarFilterOption.value) {
            case 'week':
              fromDate = dayjs(selectedDateRange.value.start).startOf('week')
              toDate = dayjs(selectedDateRange.value.end).endOf('week')
              break
            case 'month':
              fromDate = dayjs(selectedMonth.value).startOf('month')
              toDate = dayjs(selectedMonth.value).endOf('month')
              break
            case 'year':
              fromDate = dayjs(selectedDate.value).startOf('year')
              toDate = dayjs(selectedDate.value).endOf('year')
              break
          }

          if (from.isSameOrAfter(fromDate) && from.isSameOrBefore(toDate)) {
            pushToArray(rangedData, record, range)
          }
        }
      }
    })
  })

  return rangedData
})

const options = computed(() => {
  switch (activeCalendarView.value) {
    case 'day' as const:
      if (calDataType.value === UITypes.Date) {
        return [
          { label: 'In this day', value: 'day' },
          { label: 'Without dates', value: 'withoutDates' },
          { label: 'All records', value: 'allRecords' },
        ]
      } else {
        return [
          { label: 'In this day', value: 'day' },
          { label: 'Without dates', value: 'withoutDates' },
          { label: 'All records', value: 'allRecords' },
          { label: 'In selected hours', value: 'selectedHours' },
        ]
      }
    case 'week' as const:
      if (calDataType.value === UITypes.Date) {
        return [
          { label: 'In selected date', value: 'selectedDate' },
          { label: 'Without dates', value: 'withoutDates' },
          { label: 'In selected week', value: 'week' },
          { label: 'All records', value: 'allRecords' },
        ]
      } else {
        return [
          { label: 'Without dates', value: 'withoutDates' },
          { label: 'All records', value: 'allRecords' },
          { label: 'In selected hours', value: 'selectedHours' },
          { label: 'In selected week', value: 'week' },
          { label: 'In selected date', value: 'selectedDate' },
        ]
      }
    case 'month' as const:
      return [
        { label: 'In this month', value: 'month' },
        { label: 'Without dates', value: 'withoutDates' },
        { label: 'All records', value: 'allRecords' },
        { label: 'In selected date', value: 'selectedDate' },
      ]
    case 'year' as const:
      return [
        { label: 'In this year', value: 'year' },
        { label: 'Without dates', value: 'withoutDates' },
        { label: 'All records', value: 'allRecords' },
        { label: 'In selected date', value: 'selectedDate' },
      ]
  }
})

const sideBarListScrollHandle = useDebounceFn(async (e: Event) => {
  const target = e.target as HTMLElement
  if (target.clientHeight + target.scrollTop + INFINITY_SCROLL_THRESHOLD >= target.scrollHeight) {
    const pageSize = appInfo.value?.defaultLimit ?? 25
    const page = Math.ceil(formattedSideBarData.value.length / pageSize)

    await loadMoreSidebarData({
      offset: page * pageSize,
    })
  }
})

const newRecord = () => {
  const row = {
    ...rowDefaultData(meta.value?.columns),
  }

  if (activeCalendarView.value === 'day') {
    row[calendarRange.value[0]!.fk_from_col!.title!] = selectedDate.value.format('YYYY-MM-DD HH:mm:ssZ')
  } else if (activeCalendarView.value === 'week') {
    row[calendarRange.value[0]!.fk_from_col!.title!] = selectedDateRange.value.start.format('YYYY-MM-DD HH:mm:ssZ')
  } else if (activeCalendarView.value === 'month') {
    row[calendarRange.value[0]!.fk_from_col!.title!] = (selectedDate.value ?? selectedMonth.value).format('YYYY-MM-DD HH:mm:ssZ')
  } else if (activeCalendarView.value === 'year') {
    row[calendarRange.value[0]!.fk_from_col!.title!] = selectedDate.value.format('YYYY-MM-DD HH:mm:ssZ')
  }

  emit('newRecord', { row, oldRow: {}, rowMeta: { new: true } })
}

const width = ref(0)

const widthListener = () => {
  width.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('resize', widthListener)
})

onUnmounted(() => {
  window.removeEventListener('resize', widthListener)
})
</script>

<template>
  <div
    :class="{
      '!w-0': !props.visible,
      'min-w-[356px]': width > 1440 && props.visible,
      'min-w-[264px]': width <= 1440 && props.visible,
      'nc-calendar-side-menu-open': props.visible,
    }"
    class="h-full border-l-1 border-gray-200 transition-all"
    data-testid="nc-calendar-side-menu"
  >
    <div
      :class="{
        '!hidden': width <= 1440,
        'px-4 pt-3 pb-4 ': activeCalendarView === ('day' as const) || activeCalendarView === ('week' as const),
      }"
      class="flex flex-col"
    >
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
        is-week-picker
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
        is-year-picker
      />
    </div>

    <div
      :class="{
        '!border-t-0': width <= 1440,
      }"
      class="border-t-1 border-gray-200 relative flex flex-col gap-y-4 pt-3"
    >
      <div class="flex px-4 items-center gap-2">
        <a-input
          v-model:value="searchQuery.value"
          :class="{
            '!border-brand-500': searchQuery.value.length > 0,
          }"
          class="!rounded-lg !h-8 !border-gray-200 !px-4"
          data-testid="nc-calendar-sidebar-search"
          placeholder="Search records"
        >
          <template #prefix>
            <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500" />
          </template>
        </a-input>
        <NcSelect v-model:value="sideBarFilterOption" class="min-w-38 !text-gray-600" data-testid="nc-calendar-sidebar-filter">
          <a-select-option v-for="option in options" :key="option.value" :value="option.value" class="!text-gray-600">
            <div class="flex items-center justify-between gap-2">
              <div class="truncate flex-1">
                <NcTooltip :title="option.label" placement="top" show-on-truncate-only>
                  <template #title>{{ option.label }}</template>
                  {{ option.label }}
                </NcTooltip>
              </div>
              <component
                :is="iconMap.check"
                v-if="sideBarFilterOption === option.value"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </NcSelect>
      </div>

      <div
        v-if="calendarRange"
        :ref="sideBarListRef"
        :class="{
         '!h-[calc(100vh-10.5rem)]': width <= 1440,
        'h-[calc(100vh-36.2rem)]': activeCalendarView === ('day' as const) || activeCalendarView === ('week' as const) && width >= 1440,
        'h-[calc(100vh-25.1rem)]': activeCalendarView === ('month' as const) || activeCalendarView === ('year' as const)  && width >= 1440,
   
      }"
        class="nc-scrollbar-md pl-4 pr-4 overflow-y-auto"
        data-testid="nc-calendar-side-menu-list"
        @scroll="sideBarListScrollHandle"
      >
        <NcButton
          v-if="isUIAllowed('dataEdit') && props.visible"
          v-e="['c:calendar:calendar-new-record-btn']"
          class="!absolute right-5 !border-brand-500 bottom-5 !h-12 !w-12"
          data-testid="nc-calendar-side-menu-new-btn"
          type="secondary"
          @click="newRecord"
        >
          <div class="px-4 flex items-center gap-2 justify-center">
            <component :is="iconMap.plus" class="h-6 w-6 text-lg text-brand-500" />
          </div>
        </NcButton>
        <div v-if="renderData.length === 0 || isSidebarLoading" class="flex h-full items-center justify-center">
          <GeneralLoader v-if="isSidebarLoading" size="large" />

          <div v-else class="text-gray-500">
            {{ t('msg.noRecordsFound') }}
          </div>
        </div>
        <template v-else-if="renderData.length > 0">
          <div class="gap-2 flex flex-col">
            <LazySmartsheetRow v-for="(record, rowIndex) in renderData" :key="rowIndex" :row="record">
              <LazySmartsheetCalendarSideRecordCard
                :draggable="sideBarFilterOption === 'withoutDates' && activeCalendarView !== 'year'"
                :from-date="
                record.rowMeta.range?.fk_from_col
                  ? calDataType === UITypes.Date
                    ? dayjs(record.row[record.rowMeta.range.fk_from_col.title!]).format('DD MMM')
                    : dayjs(record.row[record.rowMeta.range.fk_from_col.title!]).format('DD MMM•HH:mm A')
                  : null
              "
                :invalid="
                record.rowMeta.range!.fk_to_col &&
                dayjs(record.row[record.rowMeta.range!.fk_from_col.title!]).isAfter(
                  dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]),
                )
              "
                :row="record"
                :to-date="
                record.rowMeta.range!.fk_to_col
                  ? calDataType === UITypes.Date
                    ? dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]).format('DD MMM')
                    : dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]).format('DD MMM•HH:mm A')
                  : null
              "
                color="blue"
                data-testid="nc-sidebar-record-card"
                @click="emit('expandRecord', record)"
                @dragstart="dragStart($event, record)"
                @dragover.prevent
              >
                <template v-if="!isRowEmpty(record, displayField)">
                  <LazySmartsheetCalendarCell v-model="record.row[displayField!.title!]" :column="displayField" />
                </template>
              </LazySmartsheetCalendarSideRecordCard>
            </LazySmartsheetRow>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

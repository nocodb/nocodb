<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['expand-record', 'new-record'])

const INFINITY_SCROLL_THRESHOLD = 100

const { isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const { t } = useI18n()

const {
  pageDate,
  displayField,
  selectedDate,
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

  dragElement.value.classList.add('hide')
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
          { label: 'In selected date', value: 'selectedDate' },
        ]
      }
    case 'week' as const:
      return [
        { label: 'In this week', value: 'week' },
        { label: 'Without dates', value: 'withoutDates' },
        { label: 'All records', value: 'allRecords' },
      ]
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
</script>

<template>
  <div
    :class="{
      'w-0': !props.visible,
      'w-1/4 min-w-[22.1rem]': props.visible,
    }"
    class="h-full border-l-1 border-gray-200 transition-all"
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

    <div class="px-4 relative flex flex-col gap-y-6 pt-4">
      <div class="flex items-center gap-2">
        <a-input v-model:value="searchQuery.value" class="!rounded-lg !h-8 !border-gray-200 !px-4" placeholder="Search records">
          <template #prefix>
            <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500" />
          </template>
        </a-input>
        <NcSelect v-model:value="sideBarFilterOption" :options="options" />
      </div>

      <div
        v-if="calendarRange"
        :ref="sideBarListRef"
        :class="{
        'h-[calc(100vh-36.2rem)]': activeCalendarView === ('day' as const) || activeCalendarView === ('week' as const),
        'h-[calc(100vh-25.1rem)]': activeCalendarView === ('month' as const) || activeCalendarView === ('year' as const),
      }"
        class="gap-2 flex flex-col nc-scrollbar-md overflow-y-auto nc-calendar-top-height"
        @scroll="sideBarListScrollHandle"
      >
        <NcButton
          v-if="isUIAllowed('dataEdit')"
          class="!absolute right-5 bottom-5 !h-12 !w-12"
          type="secondary"
          @click="emit('new-record', { row: {} })"
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
          <LazySmartsheetRow v-for="(record, rowIndex) in renderData" :key="rowIndex" :row="record">
            <LazySmartsheetCalendarSideRecordCard
              :draggable="sideBarFilterOption === 'withoutDates'"
              :from-date="
                record.rowMeta.range?.fk_from_col
                  ? calDataType === UITypes.Date
                    ? dayjs(record.row[record.rowMeta.range.fk_from_col.title!]).format('DD MMM')
                    : dayjs(record.row[record.rowMeta.range.fk_from_col.title!]).format('DD MMM•HH:MM A')
                  : null
              "
              :invalid="
                record.rowMeta.range!.fk_to_col &&
                dayjs(record.row[record.rowMeta.range!.fk_from_col.title!]).isAfter(
                  dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]),
                )
              "
              :name="record.row[displayField!.title!]"
              :row="record"
              :to-date="
                record.rowMeta.range!.fk_to_col
                  ? calDataType === UITypes.Date
                    ? dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]).format('DD MMM')
                    : dayjs(record.row[record.rowMeta.range!.fk_to_col.title!]).format('DD MMM•HH:MM A')
                  : null
              "
              color="blue"
              @click="emit('expand-record', record)"
              @dragstart="dragStart($event, record)"
              @dragover.prevent
            />
          </LazySmartsheetRow>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

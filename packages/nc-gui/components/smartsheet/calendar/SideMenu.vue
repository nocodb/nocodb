<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { computed, ref } from '#imports'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['expand-record', 'new-record'])

const INFINITY_SCROLL_THRESHOLD = 100

const { appInfo } = useGlobal()

const { t } = useI18n()

const {
  pageDate,
  displayField,
  selectedDate,
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
    const page = Math.floor(formattedSideBarData.value.length / pageSize)
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
      v-model:selected-date="selectedDate"
    />
    <NcMonthYearSelector
      v-else-if="activeCalendarView === ('year' as const)"
      v-model:page-date="pageDate"
      v-model:selected-date="selectedDate"
      year-picker
    />

    <div class="px-4 flex flex-col gap-y-6 pt-4">
      <div class="flex justify-between items-center">
        <span class="text-2xl font-bold">{{ t('objects.Records') }}</span>
        <NcSelect v-model:value="sideBarFilterOption" :options="options" />
      </div>
      <div class="flex items-center gap-3">
        <a-input
          v-model:value="searchQuery.value"
          class="!rounded-lg !border-gray-200 !px-4 !py-2"
          placeholder="Search your records"
        >
          <template #prefix>
            <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500" />
          </template>
        </a-input>
        <NcButton type="secondary" @click="emit('new-record')">
          <div class="px-4 flex items-center gap-2 justify-center">
            <component :is="iconMap.plus" class="h-4 w-4 text-gray-700" />
            {{ t('activity.newRecord') }}
          </div>
        </NcButton>
      </div>

      <div
        v-if="calendarRange"
        :ref="sideBarListRef"
        :class="{
        'h-[calc(100vh-40rem)]': activeCalendarView === ('day' as const) || activeCalendarView === ('week' as const),
        'h-[calc(100vh-29rem)]': activeCalendarView === ('month' as const) || activeCalendarView === ('year' as const),
      }"
        class="gap-2 flex flex-col nc-scrollbar-md overflow-y-auto nc-calendar-top-height"
        @scroll="sideBarListScrollHandle"
      >
        <div v-if="formattedSideBarData.length === 0 || isSidebarLoading" class="flex h-full items-center justify-center">
          <GeneralLoader v-if="isSidebarLoading" size="large" />

          <div v-else class="text-gray-500">
            {{ t('msg.noRecordsFound') }}
          </div>
        </div>
        <template v-else-if="formattedSideBarData.length > 0">
          <LazySmartsheetRow v-for="(record, rowIndex) in formattedSideBarData" :key="rowIndex" :row="record">
            <LazySmartsheetCalendarSideRecordCard
              :date="dayjs(record.row[calendarRange[0] ? calendarRange[0].fk_from_col.title : '']).format('YYYY-MM-DD HH:mm')"
              :name="record.row[displayField.title]"
              color="blue"
              @click="emit('expand-record', record)"
            />
          </LazySmartsheetRow>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

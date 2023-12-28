<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits(['expand-record'])

const { t } = useI18n()

const { pageDate, selectedDate, selectedDateRange, activeDates, activeCalendarView } = useCalendarViewStoreOrThrow()

const options = computed(() => {
  switch (activeCalendarView.value) {
    case 'day' as const:
      return [
        { label: 'in this day', value: 'day' },
        { label: 'without dates', value: 'withoutDates' },
        { label: 'in selected hours', value: 'selectedHours' },
        { label: 'all records', value: 'allRecords' },
      ]
    case 'week' as const:
      return [
        { label: 'in this week', value: 'week' },
        { label: 'without dates', value: 'withoutDates' },
        { label: 'in selected hours', value: 'selectedHours' },
        { label: 'all records', value: 'allRecords' },
      ]
    case 'month' as const:
      return [
        { label: 'in this month', value: 'month' },
        { label: 'without dates', value: 'withoutDates' },
        { label: 'all records', value: 'allRecords' },
        { label: 'in selected date', value: 'selectedDate' },
      ]
    case 'year' as const:
      return [
        { label: 'in this year', value: 'year' },
        { label: 'without dates', value: 'withoutDates' },
        { label: 'all records', value: 'allRecords' },
        { label: 'in selected date', value: 'selectedDate' },
      ]
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
      v-model:active-dates="activeDatess"
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
        <NcSelect :options="options" value="all records" />
      </div>
      <a-input class="!rounded-lg !border-gray-200 !px-4 !py-2" placeholder="Search your records">
        <template #prefix>
          <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500" />
        </template>
      </a-input>

      <div
        :class="{
        'h-[calc(100vh-40rem)]': activeCalendarView === ('day' as const) || activeCalendarView === ('week' as const),
        'h-[calc(100vh-29rem)]': activeCalendarView === ('month' as const) || activeCalendarView === ('year' as const),
      }"
        class="gap-2 flex flex-col nc-scrollbar-md overflow-y-auto nc-calendar-top-height"
      >
        <LazySmartsheetCalendarSideRecordCard
          v-for="(x, id) in Array(50)"
          :key="id"
          :color="x % 2 === 0 ? 'maroon' : 'blue'"
          date="27 April 2003"
          name="Saturday HackNight"
          @click="emit('expand-record', id)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

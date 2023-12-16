<script setup lang="ts">

import {CalendarViewTypeInj} from "#imports";

const props = defineProps<{
  visible: boolean
}>()

const activeCalendarView = inject(CalendarViewTypeInj, ref('month' as const))

const {t} = useI18n()

const emit = defineEmits(['expand-record']);

const calendarViewType = inject(CalendarViewTypeInj, ref())

const options = computed(() => {
  switch (calendarViewType.value) {
    case 'day' as const:
      return [
        {label: 'in this day', value: 'day'},
        {label: 'without dates', value: 'withoutDates'},
        {label: 'in selected hours', value: 'selectedHours'},
        {label: 'all records', value: 'allRecords'},
      ]
    case 'week' as const:
      return [
        {label: 'in this week', value: 'week'},
        {label: 'without dates', value: 'withoutDates'},
        {label: 'in selected hours', value: 'selectedHours'},
        {label: 'all records', value: 'allRecords'},
      ]
    case 'month' as const:
      return [
        {label: 'in this month', value: 'month'},
        {label: 'without dates', value: 'withoutDates'},
        {label: 'all records', value: 'allRecords'},
        {label: 'in selected date', value: 'selectedDate'},
      ]
    case 'year' as const:
      return [
        {label: 'in this year', value: 'year'},
        {label: 'without dates', value: 'withoutDates'},
        {label: 'all records', value: 'allRecords'},
        {label: 'in selected date', value: 'selectedDate'},
      ]
  }
})




</script>

<template>
  <div :class="{
    'w-0': !props.visible,
    'w-1/4 min-w-[22.1rem]': props.visible,
    'transition-all': true,
  }" class="h-full border-l-1 border-gray-200">
    <NcDatePicker />
    <div class="px-4 flex flex-col gap-y-6 pt-4">
      <div class="flex justify-between items-center">
        <span class="text-2xl font-bold">{{ t('objects.records') }}</span>
        <NcSelect :options="options" value="all records"/>
      </div>
      <a-input class="!rounded-lg  !border-gray-200 !px-4 !py-2" placeholder="Search your records">
        <template #prefix>
          <component :is="iconMap.search" class="h-4 w-4 mr-1 text-gray-500"/>
        </template>
      </a-input>

      <div class="gap-2 flex flex-col nc-scrollbar-md overflow-y-auto nc-calendar-top-height">
        <LazySmartsheetCalendarRecordCard v-for="(x, id) in Array(4)" :color="x%2 === 0 ? 'maroon': 'blue'"
                                          date="27 April 2003" name="Saturday HackNight" @click="emit('expand-record', id)"/>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-calendar-top-height {
  height: calc(100vh - 40rem);
}
</style>
<script setup lang="ts">
import Draggable from 'vuedraggable'

const { pageDate, selectedDate } = useCalendarViewStoreOrThrow();

const isMondayFirst = ref(false);

const days = computed(() => {
  if (isMondayFirst.value) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  } else {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
})

const isDayInPagedMonth = (date: Date) => {
  return date.getMonth() === pageDate.value.getMonth();
}

const dates = computed(() => {
  const startOfMonth = new Date(pageDate.value.getFullYear(), pageDate.value.getMonth(), 1);
  const dayOffset = isMondayFirst.value ? 1 : 0;
  const dayOfWeek = (startOfMonth.getDay() - dayOffset + 7) % 7;
  startOfMonth.setDate(startOfMonth.getDate() - dayOfWeek);
  const datesArray = [];
  while (datesArray.length < 42) {
    datesArray.push(new Date(startOfMonth));
    startOfMonth.setDate(startOfMonth.getDate() + 1);
  }
  return datesArray;
});

const selectDate = (date: Date) => {
  if (!date) return;
  selectedDate.value = date;
}

const isSameDate = (date1: Date, date2: Date) => {
  if(!date1 || !date2) return false;
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
}

const isDateSelected = (date: Date) => {
  if (!selectedDate.value) return false;
  const propDate = new Date(selectedDate.value);
  return isSameDate(propDate, date);
}

</script>

<template>
  <div class="h-full">
    <div class="grid grid-cols-7">
      <div v-for="day in days" :key="day" class="text-center bg-gray-50 py-1 text-sm border-b-1 border-r-1 last:border-r-0 border-gray-200 font-semibold text-gray-800">
        {{ day }}
      </div>
    </div>
    <div class="grid grid-cols-7 h-full" >
      <div v-for="date in dates" :key="date" :class="{
        '!border-x-2 !border-y-2 border-brand-500': isDateSelected(date),
        '!bg-gray-50 !text-gray-400': !isDayInPagedMonth(date),

      }" class="text-right !h-[100%] group grid-cell py-1 text-sm border-b-1 border-r-1 bg-white last:border-r-0 border-gray-200 font-semibold text-gray-800"
      @click="selectDate(date)"
      >
        <div class="h-full">
        <div class="flex justify-between p-1">
          <span :class="{
            'block': !isDateSelected(date),
            'hidden': isDateSelected(date),
          }" class="group-hover:hidden"></span>
          <NcButton type="secondary" size="small" :class="{
            '!block': isDateSelected(date),
            '!hidden': !isDateSelected(date),
          }" class="!group-hover:block">
            <component :is="iconMap.plus" class="h-4 w-4"/>
          </NcButton>
          <span class="px-1 py-2">{{ date.getDate() }}</span>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
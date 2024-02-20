<script setup lang="ts">

interface Props {
  selectedDate?: Date | null;
  isDisabled?: boolean;
  pageDate?: Date;
  activeDates?: Date[];
  isMondayFirst?: boolean;
}

const emit = defineEmits(['change', 'update:selectedDate', 'update:pageDate']);
const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  isDisabled: false,
  isMondayFirst: false,
  pageDate: new Date(),
  activeDates: [],
});

const pageDate = useVModel(props, 'pageDate', emit);
const selectedDate = useVModel(props, 'selectedDate', emit);
const activeDates = useVModel(props, 'activeDates', emit);

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  } else {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }
})

const currentMonth = computed(() => {
  return pageDate.value.toLocaleString('default', { month: 'long' }) + ' ' + pageDate.value.getFullYear();
});

const getDay = (date: Date) => {
  return date.getDate();
};

const blankDays = computed((): any => {
  const date = new Date(pageDate.value);
  const dObj = new Date(date.getFullYear(), date.getMonth(), 1, date.getHours(), date.getMinutes());
  if (props.isMondayFirst) {
    return getDay(dObj) > 0 ? getDay(dObj) - 1 : 6;
  }
  return getDay(dObj);
});

function isSelectedDate(dObj: Date): boolean {
  const propDate = new Date(selectedDate.value);
  return props.selectedDate ? compareDates(propDate, dObj) : false;
}

const isActiveDate = (date: Date) => {
  return activeDates.value.some((d) => compareDates(d, date));
};

const compareDates = (date1: Date, date2: Date) => {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
};

const daysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const setDate = (date: Date, day: number) => {
  date.setDate(day);
};

interface DateObj {
  date: number;
  isSelected: boolean;
  timestamp: number;
  hasEvent: boolean;
}

const monthDays = computed((): DateObj[] => {
  const d = new Date(pageDate.value);
  const tDays: DateObj[] = [];

  const dObj = new Date(d.getFullYear(), d.getMonth(), 1, d.getHours(), d.getMinutes());
  const t = daysInMonth(dObj.getFullYear(), dObj.getMonth());
  for (let i = 0; i < t; i += 1) {
    tDays.push({
      timestamp: dObj.getTime(),
      date: dObj.getDate(),
      isSelected: isSelectedDate(dObj),
      hasEvent: isActiveDate(dObj),
    });
    setDate(dObj, (dObj.getDate() + 1));
  }
  return tDays;
});

const paginateMonth = (direction: 'next' | 'prev') => {
  const newDate = new Date(pageDate.value);
  if (direction === 'next') {
    newDate.setMonth(newDate.getMonth() + 1);
  } else {
    newDate.setMonth(newDate.getMonth() - 1);
  }
  pageDate.value = newDate;
  emit('update:pageDate', newDate);
};

const selectDate = (day: number) => {
  const date = new Date(pageDate.value);
  date.setDate(day);
  selectedDate.value = date;
  emit('update:selectedDate', date);
};
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <NcButton type="secondary" size="small" @click="paginateMonth('prev')">
        <component :is="iconMap.doubleLeftArrow" class="h-4 w-4" />
      </NcButton>
      <span class="font-bold text-gray-700">{{ currentMonth }}</span>
      <NcButton type="secondary" size="small" @click="paginateMonth('next')">
        <component :is="iconMap.doubleRightArrow" class="h-4 w-4" />
      </NcButton>
    </div>
    <div class="border-1 border-gray-200 rounded-t-xl max-w-[320px]">
      <div class="flex flex-row bg-gray-100 gap-2 rounded-t-xl justify-between p-2">
        <span v-for="day in days" class="h-9 flex items-center justify-center  w-9 text-gray-500">{{ day }}</span>
      </div>
      <div class="flex flex-row flex-wrap gap-2 p-2">
        <span v-for="day in blankDays" class="h-9 w-9"></span>
        <span v-for="day in monthDays" :key="day.timestamp" :class="{
          'bg-brand-50 border-2 !border-brand-500' : day.isSelected,
          'hover:(border-1 border-gray-200 bg-gray-100)' : !day.isSelected
        }" class="h-9 w-9 px-1 py-2 relative font-medium rounded-lg flex items-center cursor-pointer justify-center"
        @click="selectDate(day.date)"
        >
          <span v-if="day.hasEvent" class="absolute h-1.5 w-1.5 rounded-full bg-brand-500 top-1 right-1"></span>
          {{day.date}}
        </span>
      </div>
    </div>


  </div>
</template>

<style scoped lang="scss"></style>

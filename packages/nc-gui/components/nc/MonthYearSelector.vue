<script lang="ts" setup>

interface Props {
  selectedDate?: Date | null;
  isDisabled?: boolean;
  pageDate?: Date;
  yearPicker?: boolean;
}

const emit = defineEmits(['update:selected-date', 'update:page-date']);
const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  isDisabled: false,
  pageDate: new Date(),
  yearPicker: false,
});

const pageDate = useVModel(props, 'pageDate', emit);
const selectedDate = useVModel(props, 'selectedDate', emit);

const years = computed(() => {
  const date = new Date(pageDate.value);
  const startYear = date.getFullYear() - 5;
  const endYear = date.getFullYear() + 6;
  const years = [];
  for (let i = startYear; i <= endYear; i++) {
    years.push({
      label: i,
      value: new Date(i, 0, 1)
    });
  }
  return years;
});

const currentYear = computed(() => {
  return pageDate.value.getFullYear();
});

const months = computed(() => {
  const date = new Date(pageDate.value);
  return [
    {
      label: 'January',
      value: new Date(date.getFullYear(), 0, 1)
    },
    {
      label: 'February',
      value: new Date(date.getFullYear(), 1, 1)
    },
    {
      label: 'March',
      value: new Date(date.getFullYear(), 2, 1)
    },
    {
      label: 'April',
      value: new Date(date.getFullYear(), 3, 1)
    },
    {
      label: 'May',
      value: new Date(date.getFullYear(), 4, 1)
    },
    {
      label: 'June',
      value: new Date(date.getFullYear(), 5, 1)
    },
    {
      label: 'July',
      value: new Date(date.getFullYear(), 6, 1)
    },
    {
      label: 'August',
      value: new Date(date.getFullYear(), 7, 1)
    },
    {
      label: 'September',
      value: new Date(date.getFullYear(), 8, 1)
    },
    {
      label: 'October',
      value: new Date(date.getFullYear(), 9, 1)
    },
    {
      label: 'November',
      value: new Date(date.getFullYear(), 10, 1)
    },
    {
      label: 'December',
      value: new Date(date.getFullYear(), 11, 1)
    }
  ]
})

const compareDates = (date1: Date, date2: Date) => {
  if (!date1 || !date2) return false;
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth();
}

const isMonthSelected = (date: Date) => {
  if (!selectedDate.value) return false;
  return compareDates(date, selectedDate.value);
}

const paginateMonth = (action: 'next' | 'prev') => {
  const date = new Date(pageDate.value);
  if (action === 'next') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setFullYear(date.getFullYear() - 1);
  }
  pageDate.value = date;
};

const paginateYear = (action: 'next' | 'prev') => {
  const date = new Date(pageDate.value);
  if (action === 'next') {
    date.setFullYear(date.getFullYear() + 12);
  } else {
    date.setFullYear(date.getFullYear() - 12);
  }
  pageDate.value = date;
};

const paginate = (action: 'next' | 'prev') => {
  if (props.yearPicker) {
    paginateYear(action);
  } else {
    paginateMonth(action);
  }
};

const compareYear = (date1: Date, date2: Date) => {
  if (!date1 || !date2) return false;
  return date1.getFullYear() === date2.getFullYear();
}

</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <NcButton size="small" type="secondary" @click="paginate('prev')">
        <component :is="iconMap.doubleLeftArrow" class="h-4 w-4"/>
      </NcButton>
      <span class="font-bold text-gray-700">{{ yearPicker ? 'Select Year' : currentYear }}</span>
      <NcButton size="small" type="secondary" @click="paginate('next')">
        <component :is="iconMap.doubleRightArrow" class="h-4 w-4"/>
      </NcButton>
    </div>
    <div class="border-1 border-gray-200 rounded-y-xl max-w-[320px]">
      <div class="grid grid-cols-4 gap-2 p-2">
        <span v-for="(month) in months" v-if="!yearPicker" :key="month.value" :class="{
          '!bg-brand-50 !border-2 !border-brand-500' : isMonthSelected(month.value),
        }"
              class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
              @click="selectedDate = month.value"
        >
          {{ month.label.slice(0, 3) }}
        </span>
        <span v-for="(year) in years" v-if="yearPicker" :key="year" :class="{
          '!bg-brand-50 !border-2 !border-brand-500' : compareYear(year.value, selectedDate)
        }"
              class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
              @click="selectedDate = year.value"
        >
          {{ year.label }}
        </span>
      </div>
    </div>


  </div>
</template>

<style lang="scss" scoped>

</style>
<script lang="ts" setup>
import dayjs from 'dayjs'

const emit = defineEmits(['new-record', 'expand-record'])

const { pageDate, selectedDate, formattedData, displayField, calendarRange } = useCalendarViewStoreOrThrow()

const isMondayFirst = ref(true)

const days = computed(() => {
  if (isMondayFirst.value) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
})

const isDayInPagedMonth = (date: Date) => {
  return date.getMonth() === pageDate.value.getMonth()
}

const dates = computed(() => {
  const startOfMonth = dayjs(pageDate.value).startOf('month')
  const endOfMonth = dayjs(pageDate.value).endOf('month')

  const firstDayToDisplay = startOfMonth.startOf('week').add(isMondayFirst.value ? 0 : -1, 'day')
  const lastDayToDisplay = endOfMonth.endOf('week').add(isMondayFirst.value ? 0 : -1, 'day')

  const daysToDisplay = lastDayToDisplay.diff(firstDayToDisplay, 'day') + 1
  let numberOfRows = Math.ceil(daysToDisplay / 7)
  numberOfRows = Math.max(numberOfRows, 5)

  const weeksArray = []
  let currentDay = firstDayToDisplay
  for (let week = 0; week < numberOfRows; week++) {
    const weekArray = []
    for (let day = 0; day < 7; day++) {
      weekArray.push(currentDay.toDate())
      currentDay = currentDay.add(1, 'day')
    }
    weeksArray.push(weekArray)
  }

  return weeksArray
})

const selectDate = (date: Date) => {
  selectedDate.value = date
}

const isDateSelected = (date: Date) => {
  if (!selectedDate.value) return false
  return dayjs(date).isSame(selectedDate.value, 'day')
}
</script>

<template>
  <div v-if="calendarRange" class="h-full">
    <div class="grid grid-cols-7">
      <div
        v-for="(day, index) in days"
        :key="index"
        class="text-center bg-gray-50 py-1 text-sm border-b-1 border-r-1 last:border-r-0 border-gray-200 font-semibold text-gray-800"
      >
        {{ day }}
      </div>
    </div>
    <div
      :class="{
        'grid-rows-5': dates.length === 5,
        'grid-rows-6': dates.length === 6,
        'grid-rows-7': dates.length === 7,
      }"
      class="grid h-full pb-7.5"
    >
      <div v-for="(week, weekIndex) in dates" :key="weekIndex" class="grid grid-cols-7 grow">
        <div
          v-for="(day, dateIndex) in week"
          :key="`${weekIndex}-${dateIndex}`"
          :class="{
            'border-brand-500 border-2': isDateSelected(day),
            '!text-gray-400': !isDayInPagedMonth(day),
          }"
          class="text-right group py-1 text-sm h-full border-1 bg-white border-gray-200 font-semibold hover:bg-gray-50 text-gray-800"
          @click="selectDate(day)"
        >
          <div class="flex justify-between p-1">
            <span
              :class="{
                block: !isDateSelected(day),
                hidden: isDateSelected(day),
              }"
              class="group-hover:hidden"
            ></span>
            <NcButton
              :class="{
                '!block': isDateSelected(day),
                '!hidden': !isDateSelected(day),
              }"
              class="!group-hover:block"
              size="small"
              type="secondary"
              @click="emit('new-record')"
            >
              <component :is="iconMap.plus" class="h-4 w-4" />
            </NcButton>
            <span class="px-1 py-2">{{ dayjs(day).format('DD') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

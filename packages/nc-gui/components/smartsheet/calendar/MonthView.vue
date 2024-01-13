<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Row } from '#imports'

const emit = defineEmits(['new-record', 'expand-record'])

const { selectedDate, formattedData, displayField, calendarRange } = useCalendarViewStoreOrThrow()

const isMondayFirst = ref(true)

const days = computed(() => {
  if (isMondayFirst.value) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
})

const calendarGridContainer = ref()

const { width: gridContainerWidth, height: gridContainerHeight } = useElementSize(calendarGridContainer)

const isDayInPagedMonth = (date: Date) => {
  return date.getMonth() === selectedDate.value.getMonth()
}

const dates = computed(() => {
  const startOfMonth = dayjs(selectedDate.value).startOf('month')
  const endOfMonth = dayjs(selectedDate.value).endOf('month')

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

const recordsToDisplay = computed<Array<Row>>(() => {
  if (!dates.value || !calendarRange.value) return []

  const perWidth = gridContainerWidth.value / 7
  const perHeight = gridContainerHeight.value / dates.value.length
  const perRecordHeight = '40'

  const recordsInDay: { [key: string]: number } = {}

  if (!calendarRange.value) return []
  const recordsToDisplay: Array<Row> = []
  calendarRange.value.forEach((range) => {
    const startCol = range.fk_from_col
    const endCol = range.fk_to_col
    formattedData.value.forEach((record: Row) => {
      if (!endCol && startCol) {
        const startDate = dayjs(record.row[startCol.title])
        recordsInDay[startDate.format('YYYY-MM-DD')] = recordsInDay[startDate.format('YYYY-MM-DD')] + 1 || 1

        const weekIndex = dates.value.findIndex((week) => {
          return (
            week.findIndex((day) => {
              return dayjs(day).isSame(startDate, 'day')
            }) !== -1
          )
        })

        const dayIndex = dates.value[weekIndex].findIndex((day) => {
          return dayjs(day).isSame(startDate, 'day')
        })

        const style = {
          left: `${dayIndex * perWidth}px`,
          width: `${perWidth}px`,
        }

        const recordIndex = recordsInDay[startDate.format('YYYY-MM-DD')]

        const top = weekIndex * perHeight + 40 + (recordIndex - 1) * perRecordHeight

        const heightRequired = perRecordHeight * recordIndex + 40

        if (heightRequired > perHeight) {
          style.display = 'none'
        } else {
          style.top = `${top}px`
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            style,
            range,
          },
        })
      } else if (startCol && endCol) {
        // TODO: Handle range
      }
    })
  })
  console.log(recordsInDay)
  return recordsToDisplay
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
  <div v-if="calendarRange" class="h-full relative">
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
      ref="calendarGridContainer"
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
    <div class="absolute inset-0 pointer-events-none mt-8 pb-7.5">
      <div
        v-for="(record, recordIndex) in recordsToDisplay"
        :key="recordIndex"
        :style="record.rowMeta.style"
        class="absolute pointer-events-auto"
        draggable="true"
        @dragover.prevent
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :date="record.row[record.rowMeta.range.fk_from_col.title]"
            :name="record.row[displayField.title]"
            @click="emit('expand-record', record)"
          />
        </LazySmartsheetRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

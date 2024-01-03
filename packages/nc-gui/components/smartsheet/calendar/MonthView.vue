<script lang="ts" setup>
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
  const startOfMonth = new Date(pageDate.value.getFullYear(), pageDate.value.getMonth(), 1)
  const dayOffset = isMondayFirst.value ? 1 : 0
  const dayOfWeek = (startOfMonth.getDay() - dayOffset + 7) % 7
  startOfMonth.setDate(startOfMonth.getDate() - dayOfWeek)
  const datesArray = []
  while (datesArray.length < 42) {
    datesArray.push(new Date(startOfMonth))
    startOfMonth.setDate(startOfMonth.getDate() + 1)
  }
  return datesArray
})

const getGridPosition = (record: Row) => {
  if (!calendarRange.value || !calendarRange[0])
    return {
      colStart: 1,
      colEnd: 1,
      rowStart: 1,
      rowEnd: 1,
    }
  const firstDayOfMonth = new Date(pageDate.value.getFullYear(), pageDate.value.getMonth(), 1).getDay()

  const startDate = new Date(record.row[calendarRange[0].fk_from_col.title])
  const startDayIndex = startDate.getDate() - 1 + firstDayOfMonth
  const endDate = new Date(record.row[calendarRange[0].fk_to_col.title])
  const endDayIndex = endDate.getDate() - 1 + firstDayOfMonth

  const startRow = Math.floor(startDayIndex / 7) + 1
  let endRow = Math.floor(endDayIndex / 7) + 1

  if (endDate.getMonth() !== pageDate.value.getMonth()) {
    endRow = Math.ceil((new Date(pageDate.value.getFullYear(), pageDate.value.getMonth() + 1, 0).getDate() + firstDayOfMonth) / 7)
  }

  const startCol = (startDayIndex % 7) + 1
  let endCol = (endDayIndex % 7) + 1

  if (endCol === 1) {
    endRow++
    endCol = 8
  }

  return {
    colStart: startCol,
    colEnd: endCol,
    rowStart: startRow,
    rowEnd: endRow,
  }
}

const selectDate = (date: Date) => {
  if (!date) return
  selectedDate.value = date
}

const isSameDate = (date1: Date, date2: Date) => {
  if (!date1 || !date2) return false
  return (
    date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
  )
}

const isDateSelected = (date: Date) => {
  if (!selectedDate.value) return false
  const propDate = new Date(selectedDate.value)
  return isSameDate(propDate, date)
}

const handleScroll = (event) => {
  if (event.deltaY > 0) {
    pageDate.value.setMonth(pageDate.value.getMonth() + 1)
  } else {
    pageDate.value.setMonth(pageDate.value.getMonth() - 1)
  }
}

const eventsByDate = computed(() => {
  if (!formattedData.value) return {}
  const events = {}
  formattedData.value.forEach((record) => {
    const date = record.row[calendarRange.value[0].fk_from_col.title]
    if (!events[new Date().getDate()]) {
      events[date] = []
    }
    events[date].push(record)
  })
  return events
})
</script>

<template>
  <div v-if="calendarRange && calendarRange[0] && calendarRange[0].fk_from_col" class="h-full" @scroll="handleScroll">
    <div class="grid grid-cols-7">
      <div
        v-for="(day, index) in days"
        :key="index"
        class="text-center bg-gray-50 py-1 text-sm border-b-1 border-r-1 last:border-r-0 border-gray-200 font-semibold text-gray-800"
      >
        {{ day }}
      </div>
    </div>
    <div class="grid relative grid-cols-7 h-full">
      <div
        v-for="(date, id) in dates"
        :key="id"
        :class="{
          'border-brand-500': isDateSelected(date),
          '!text-gray-400': !isDayInPagedMonth(date),
        }"
        class="text-right !h-[100%] group grid-cell py-1 text-sm hover:bg-gray-50 border-1 bg-white last:border-r-0 border-gray-200 font-semibold text-gray-800"
        @click="selectDate(date)"
      >
        <div class="h-full">
          <div class="flex justify-between p-1">
            <span
              :class="{
                block: !isDateSelected(date),
                hidden: isDateSelected(date),
              }"
              class="group-hover:hidden"
            ></span>
            <NcButton
              :class="{
                '!block': isDateSelected(date),
                '!hidden': !isDateSelected(date),
              }"
              class="!group-hover:block"
              size="small"
              type="secondary"
              @click="emit('new-record')"
            >
              <component :is="iconMap.plus" class="h-4 w-4" />
            </NcButton>
            <span class="px-1 py-2">{{ date.getDate() }}</span>
          </div>
          <pre></pre>
          <LazySmartsheetRow v-for="(record, recordId) in eventsByDate[date.getDate()]" :key="recordId" :row="record">
            <LazySmartsheetCalendarRecordCard
              v-if="calendarRange && calendarRange[0]"
              :date="record.row[calendarRange[0].fk_from_col.title]"
              :name="record.row[displayField.title]"
              color="blue"
              @click="emit('expand-record', record)"
            />
          </LazySmartsheetRow>
        </div>
      </div>
      <!--      <LazySmartsheetRow
        v-for="(record, recordId) in formattedData"
        :key="recordId"
        :class="[
          `!col-start-[${getGridPosition(record)}]`,
          `!col-span-[${getGridPosition(record).colEnd - getGridPosition(record).colStart}]`,
          `!row-start-[${getGridPosition(record).rowStart}]`,
          `!row-span-[${getGridPosition(record).rowEnd - getGridPosition(record).rowStart}]`,
        ]"
        :row="record"
        class="event-display absolute w-full mt-16 px-2"
      >
        <LazySmartsheetCalendarRecordCard
          v-if="calendarRange && calendarRange[0]"
          :date="record.row[calendarRange[0].fk_from_col.title]"
          :name="record.row[displayField.title]"
          color="blue"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow> -->
    </div>
  </div>
</template>

<style lang="scss" scoped></style>

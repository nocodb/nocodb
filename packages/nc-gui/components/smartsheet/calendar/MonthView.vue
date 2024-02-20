<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes } from 'nocodb-sdk'
import type { Row } from '#imports'

const emit = defineEmits(['new-record', 'expand-record'])

const {
  selectedDate,
  selectedMonth,
  formattedData,
  formattedSideBarData,
  displayField,
  calendarRange,
  calDataType,
  updateRowProperty,
} = useCalendarViewStoreOrThrow()

const isMondayFirst = ref(true)

const meta = inject(MetaInj, ref())

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
  return date.getMonth() === selectedMonth.value.getMonth()
}

const dates = computed(() => {
  const startOfMonth = dayjs(selectedMonth.value).startOf('month')
  const endOfMonth = dayjs(selectedMonth.value).endOf('month')

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

const recordsToDisplay = computed<{
  records: Array<Row>
  count: {
    [key: string]:
      | {
          overflow: boolean
          count: number
          overflowCount: number
        }
      | undefined
  }
}>(() => {
  if (!dates.value || !calendarRange.value) return []

  const perWidth = gridContainerWidth.value / 7
  const perHeight = gridContainerHeight.value / dates.value.length
  const perRecordHeight = 40

  const spaceBetweenRecords = 35

  const recordsInDay: {
    [key: string]: {
      overflow: boolean
      count: number
      overflowCount: number
    }
  } = {}

  if (!calendarRange.value) return []

  const recordsToDisplay: Array<Row> = []
  calendarRange.value.forEach((range) => {
    const startCol = range.fk_from_col
    const endCol = range.fk_to_col

    const sortedFormattedData = [...formattedData.value]
      .filter((record) => {
        const fromDate = record.row[startCol?.title] ? dayjs(record.row[startCol.title]) : null

        if (startCol && endCol) {
          const fromDate = record.row[startCol.title] ? dayjs(record.row[startCol.title]) : null
          const toDate = record.row[endCol.title] ? dayjs(record.row[endCol.title]) : null
          return fromDate && toDate && !toDate.isBefore(fromDate)
        } else if (startCol && !endCol) {
          return !!fromDate
        }
        return false
      })
      .sort((a, b) => {
        if (startCol && endCol) {
          const startA = dayjs(a.row[startCol.title])
          const endA = dayjs(a.row[endCol.title])
          const startB = dayjs(b.row[startCol.title])
          const endB = dayjs(b.row[endCol.title])

          return endB.diff(startB) - endA.diff(startA)
        } else {
          const startA = dayjs(a.row[startCol.title])
          const startB = dayjs(b.row[startCol.title])

          return startB.diff(startA)
        }
      })

    sortedFormattedData.forEach((record: Row) => {
      if (!endCol && startCol) {
        const startDate = dayjs(record.row[startCol.title])
        const dateKey = startDate.format('YYYY-MM-DD')

        if (!recordsInDay[dateKey]) {
          recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0 }
        }
        recordsInDay[dateKey].count++

        const weekIndex = dates.value.findIndex((week) => week.some((day) => dayjs(day).isSame(startDate, 'day')))

        const dayIndex = (dates.value[weekIndex] ?? []).findIndex((day) => {
          return dayjs(day).isSame(startDate, 'day')
        })

        const style: Partial<CSSStyleDeclaration> = {
          left: `${dayIndex * perWidth}px`,
          width: `${perWidth}px`,
        }

        const recordIndex = recordsInDay[dateKey].count

        const top = weekIndex * perHeight + spaceBetweenRecords + (recordIndex - 1) * perRecordHeight
        const heightRequired = perRecordHeight * recordIndex + spaceBetweenRecords

        if (heightRequired > perHeight) {
          style.display = 'none'
          recordsInDay[dateKey].overflow = true
          recordsInDay[dateKey].overflowCount++
        } else {
          style.top = `${top}px`
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            style,
            position: 'rounded',
            range,
          },
        })
      } else if (startCol && endCol) {
        const startDate = dayjs(record.row[startCol.title])
        const endDate = dayjs(record.row[endCol.title])
        let currentWeekStart = startDate.startOf('week')
        while (currentWeekStart.isBefore(endDate)) {
          const currentWeekEnd = currentWeekStart.endOf('week')
          const recordStart = currentWeekStart.isBefore(startDate) ? startDate : currentWeekStart
          const recordEnd = currentWeekEnd.isAfter(endDate) ? endDate : currentWeekEnd

          let day = recordStart.clone()
          while (day.isSameOrBefore(recordEnd)) {
            const dateKey = day.format('YYYY-MM-DD')

            if (!recordsInDay[dateKey]) {
              recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0 }
            }
            recordsInDay[dateKey].count++
            day = day.add(1, 'day')
          }

          const weekIndex = Math.max(
            dates.value.findIndex((week) => {
              return (
                week.findIndex((day) => {
                  return dayjs(day).isSame(recordStart, 'day')
                }) !== -1
              )
            }),
            0,
          )

          let maxRecordCount = 0

          for (let i = 0; i < (dates.value[weekIndex] ?? []).length; i++) {
            const day = dates.value[weekIndex][i]

            const dateKey = dayjs(day).format('YYYY-MM-DD')
            if (!recordsInDay[dateKey]) {
              recordsInDay[dateKey] = {
                count: 0,
                overflow: false,
                overflowCount: 0,
              }
            }
            const recordIndex = recordsInDay[dateKey].count

            maxRecordCount = Math.max(maxRecordCount, recordIndex)
          }

          const startDayIndex = Math.max(
            (dates.value[weekIndex] ?? []).findIndex((day) => dayjs(day).isSame(recordStart, 'day')),
            0,
          )
          const endDayIndex = Math.max(
            (dates.value[weekIndex] ?? []).findIndex((day) => dayjs(day).isSame(recordEnd, 'day')),
            0,
          )

          const style: Partial<CSSStyleDeclaration> = {
            left: `${startDayIndex * perWidth}px`,
            width: `${(endDayIndex - startDayIndex + 1) * perWidth}px`,
          }

          const top = weekIndex * perHeight + spaceBetweenRecords + Math.max(maxRecordCount - 1, 0) * perRecordHeight
          const heightRequired = perRecordHeight * maxRecordCount + spaceBetweenRecords

          let position = 'rounded'

          const isStartMonthBeforeCurrentWeek = startDate.isBefore(selectedMonth.value, 'month')

          if (startDate.isSame(currentWeekStart, 'week') && endDate.isSame(currentWeekEnd, 'week')) {
            position = 'rounded'
          } else if (startDate.isSame(recordStart, 'week')) {
            if (isStartMonthBeforeCurrentWeek) {
              position = 'rightRounded'
            } else position = 'leftRounded'
          } else if (endDate.isSame(currentWeekEnd, 'week')) {
            position = 'rightRounded'
          } else {
            position = 'none'
          }

          if (heightRequired > perHeight) {
            style.display = 'none'
            for (let i = startDayIndex; i <= endDayIndex; i++) {
              const week = dates.value[weekIndex]
              if (!week) continue
              const day = week[i]
              const dateKey = dayjs(day).format('YYYY-MM-DD')
              if (!recordsInDay[dateKey]) continue
              recordsInDay[dateKey].overflow = true
              recordsInDay[dateKey].overflowCount++
            }
          } else {
            style.top = `${top}px`
          }

          recordsToDisplay.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              position,
              style,
              range,
            },
          })
          currentWeekStart = currentWeekStart.add(1, 'week')
        }
      }
    })
  })
  return {
    records: recordsToDisplay,
    count: recordsInDay,
  }
})

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

const dragEnter = (event: DragEvent) => {
  event.preventDefault()
  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height

  const percentX = (event.clientX - left - window.scrollX) / width

  const week = Math.floor(percentY * dates.value.length)
  const day = Math.floor(percentX * 7)

  const currSelectedDate = dayjs(selectedDate.value).startOf('month').add(week, 'week').add(day, 'day')
  selectedDate.value = currSelectedDate.toDate()
}

const dropEvent = (event: DragEvent) => {
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
      initialClickOffsetY,
      initialClickOffsetX,
    }: {
      record: Row
      initialClickOffsetY: number
      initialClickOffsetX: number
    } = JSON.parse(data)
    const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

    const percentY = (event.clientY - top - initialClickOffsetY - window.scrollY) / height
    const percentX = (event.clientX - left - initialClickOffsetX - window.scrollX) / width

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    const week = Math.floor(percentY * dates.value.length)
    const day = Math.floor(percentX * 7)

    const newStartDate = dayjs(selectedMonth.value).startOf('month').add(week, 'week').add(day, 'day')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title]: dayjs(newStartDate).format('YYYY-MM-DD'),
      },
    }

    const updateProperty = [fromCol.title]

    if (toCol) {
      const fromDate = record.row[fromCol.title] ? dayjs(record.row[fromCol.title]) : null
      const toDate = record.row[toCol.title] ? dayjs(record.row[toCol.title]) : null

      if (fromDate && toDate) {
        endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }

      newRow.row[toCol.title] = dayjs(endDate).format('YYYY-MM-DD')

      updateProperty.push(toCol.title)
    }

    if (!newRow) return

    if (dragElement.value) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value.columns)

        if (pk === extractPkFromRow(newRow.row, meta.value.columns)) {
          return newRow
        }
        return r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
        const pk = extractPkFromRow(r.row, meta.value.columns)

        return pk !== extractPkFromRow(newRow.row, meta.value.columns)
      })
    }

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value.classList.remove('hide')

      dragElement.value = null
    }

    updateRowProperty(newRow, updateProperty, false)
  }
}

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
      @drop="dropEvent"
      @dragenter.prevent="dragEnter"
    >
      <div v-for="(week, weekIndex) in dates" :key="weekIndex" class="grid grid-cols-7 grow">
        <div
          v-for="(day, dateIndex) in week"
          :key="`${weekIndex}-${dateIndex}`"
          :class="{
            'border-brand-500 border-2': isDateSelected(day),
            '!text-gray-400': !isDayInPagedMonth(day),
          }"
          class="text-right relative group py-1 text-sm h-full border-1 bg-white border-gray-200 font-semibold hover:bg-gray-50 text-gray-800"
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
          <div
            v-if="
              recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')] &&
              recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflow
            "
            class="text-xs absolute bottom-1 text-center inset-x-0 text-gray-500"
          >
            + {{ recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflowCount }} more
          </div>
        </div>
      </div>
    </div>
    <div class="absolute inset-0 pointer-events-none mt-8 pb-7.5">
      <div
        v-for="(record, recordIndex) in recordsToDisplay.records"
        :key="recordIndex"
        :style="record.rowMeta.style as Partial<CSSStyleValue>"
        class="absolute pointer-events-auto"
        draggable="true"
        @dragstart="dragStart($event, record)"
        @dragover.prevent
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :date="
              calDataType === UITypes.DateTime
                ? dayjs(record.row[record.rowMeta.range?.fk_from_col.title]).format('YYYY-MM-DD HH:mm')
                : dayjs(record.row[record.rowMeta.range?.fk_from_col.title]).format('YYYY-MM-DD')
            "
            :name="record.row[displayField.title]"
            :position="record.rowMeta.position"
            :record="record"
            @click="emit('expand-record', record)"
          />
        </LazySmartsheetRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hide {
  transition: 0.01s;
  transform: translateX(-9999px);
}
</style>

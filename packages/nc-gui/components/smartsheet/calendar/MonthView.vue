<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'

const emit = defineEmits(['newRecord', 'expandRecord'])

const {
  selectedDate,
  selectedMonth,
  formattedData,
  formattedSideBarData,
  calDataType,
  sideBarFilterOption,
  displayField,
  calendarRange,
  viewMetaProperties,
  showSideMenu,
  updateRowProperty,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const isMondayFirst = ref(true)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const maxVisibleDays = computed(() => {
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

const days = computed(() => {
  let days = []

  if (isMondayFirst.value) {
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }

  if (maxVisibleDays.value === 5) {
    days = days.filter((day) => day !== 'Sat' && day !== 'Sun')
  }

  return days
})

const calendarGridContainer = ref()

const { width: gridContainerWidth, height: gridContainerHeight } = useElementSize(calendarGridContainer)

const isDayInPagedMonth = (date: dayjs.Dayjs) => {
  return date.month() === selectedMonth.value.month()
}

const dragElement = ref<HTMLElement | null>(null)

const draggingId = ref<string | null>(null)

const resizeInProgress = ref(false)

const isDragging = ref(false)

const dragRecord = ref<Row>()

const hoverRecord = ref<string | null>()

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const focusedDate = ref<dayjs.Dayjs | null>(null)

const resizeDirection = ref<'right' | 'left'>()

const resizeRecord = ref<Row>()

const fields = inject(FieldsInj, ref())

const { fields: _fields } = useViewColumnsOrThrow()

const fieldStyles = computed(() => {
  if (!_fields.value) return new Map()
  return new Map(
    _fields.value.map((field) => [
      field.fk_column_id,
      {
        underline: field.underline,
        bold: field.bold,
        italic: field.italic,
      },
    ]),
  )
})

const getFieldStyle = (field: ColumnType) => {
  return fieldStyles.value.get(field.id)
}

const dates = computed(() => {
  const startOfMonth = selectedMonth.value.startOf('month')
  const endOfMonth = selectedMonth.value.endOf('month')

  const firstDayToDisplay = startOfMonth.startOf('week').add(isMondayFirst.value ? 0 : -1, 'day')
  const lastDayToDisplay = endOfMonth.endOf('week').add(isMondayFirst.value ? 0 : -1, 'day')

  const daysToDisplay = lastDayToDisplay.diff(firstDayToDisplay, 'day') + 1
  let numberOfRows = Math.ceil(daysToDisplay / 7)
  numberOfRows = Math.max(numberOfRows, 5)

  const weeksArray: Array<Array<dayjs.Dayjs>> = []
  let currentDay = firstDayToDisplay
  for (let week = 0; week < numberOfRows; week++) {
    const weekArray = []
    for (let day = 0; day < 7; day++) {
      weekArray.push(currentDay)
      currentDay = currentDay.add(1, 'day')
    }
    weeksArray.push(weekArray)
  }

  return weeksArray
})

const recordsToDisplay = computed<{
  records: Row[]
  count: { [p: string]: { overflow: boolean; count: number; overflowCount: number } }
}>(() => {
  if (!dates.value || !calendarRange.value) return []

  const perWidth = gridContainerWidth.value / maxVisibleDays.value
  const perHeight = gridContainerHeight.value / dates.value.length
  const perRecordHeight = 24

  const spaceBetweenRecords = 27

  // This object is used to keep track of the number of records in a day
  // The key is the date in the format YYYY-MM-DD
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

    // Filter out records that don't satisfy the range and sort them by start date
    const sortedFormattedData = [...formattedData.value].filter((record) => {
      if (startCol && endCol) {
        const fromDate = record.row[startCol.title!] ? dayjs(record.row[startCol.title!]) : null
        const toDate = record.row[endCol.title!] ? dayjs(record.row[endCol.title!]) : null
        return fromDate && toDate && !toDate.isBefore(fromDate)
      } else if (startCol && !endCol) {
        const fromDate = record.row[startCol!.title!] ? dayjs(record.row[startCol!.title!]) : null
        return !!fromDate
      }
      return false
    })

    sortedFormattedData.forEach((record: Row) => {
      if (!endCol && startCol) {
        // If there is no end date, we just display the record on the start date
        const startDate = dayjs(record.row[startCol.title!])
        const dateKey = startDate.format('YYYY-MM-DD')

        if (!recordsInDay[dateKey]) {
          recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0 }
        }
        recordsInDay[dateKey].count++
        const id = record.rowMeta.id ?? generateRandomNumber()

        // Find the index of the week from the dates array
        const weekIndex = dates.value.findIndex((week) => week.some((day) => dayjs(day).isSame(startDate, 'day')))

        // Find the index of the day from the dates array
        const dayIndex = (dates.value[weekIndex] ?? []).findIndex((day) => {
          return dayjs(day).isSame(startDate, 'day')
        })

        const style: Partial<CSSStyleDeclaration> = {
          left: `${dayIndex * perWidth}px`,
          width: `${perWidth}px`,
        }

        if (maxVisibleDays.value === 5) {
          if (dayIndex === 5 || dayIndex === 6) {
            style.display = 'none'
          }
        }

        // Number of records in that day
        const recordIndex = recordsInDay[dateKey].count

        // The top is calculated from the week index and the record index
        // If the record in 1st week and no record in that date them the top will be 0
        const top = weekIndex * perHeight + spaceBetweenRecords + (recordIndex - 1) * (perRecordHeight + 4)

        // The 25 is obtained from the trial and error
        const heightRequired = perRecordHeight * recordIndex + spaceBetweenRecords + 12

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
            id,
          },
        })
      } else if (startCol && endCol) {
        // If the range specifies fromCol and endCol
        const startDate = dayjs(record.row[startCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        let currentWeekStart = startDate.startOf('week')

        const id = record.rowMeta.id ?? generateRandomNumber()
        // Since the records can span multiple weeks, to display, we render multiple elements
        // for each week the record spans. The id is used to identify the elements that belong to the same record

        while (
          currentWeekStart.isSameOrBefore(endDate, 'day') &&
          // If the current week start is before the last day of the last week
          currentWeekStart.isBefore(dates.value[dates.value.length - 1][6])
        ) {
          // We update the record start to currentWeekStart if it is before the start date
          // and record end to currentWeekEnd if it is after the end date
          let currentWeekEnd = currentWeekStart.endOf('week')

          // If the maxVisibleDays is 5, we skip the weekends
          if (maxVisibleDays.value === 5) {
            currentWeekEnd = currentWeekEnd.subtract(2, 'day')
          }

          const recordStart = currentWeekStart.isBefore(startDate) ? startDate : currentWeekStart
          const recordEnd = currentWeekEnd.isAfter(endDate) ? endDate : currentWeekEnd

          const dayIndex = recordStart.day()

          // If the record spans multiple weeks and the maxVisibleDays is 5 and startDate is weekedend, we skip the weekends
          if (maxVisibleDays.value === 5 && (dayIndex === 0 || dayIndex === 6)) {
            currentWeekStart = currentWeekStart.add(1, 'week')
            continue
          }

          if (recordEnd.isBefore(dates.value[0][0])) {
            currentWeekStart = currentWeekStart.add(1, 'week')
            continue
          }

          // Update the recordsInDay object to keep track of the number of records in a day
          let day = recordStart.clone()
          while (day.isSameOrBefore(recordEnd)) {
            const dateKey = day.format('YYYY-MM-DD')

            if (!recordsInDay[dateKey]) {
              recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0 }
            }
            recordsInDay[dateKey].count++
            day = day.add(1, 'day')
          }

          // Find the index of the week from the dates array
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

          // Find the maximum number of records in a day in that week
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
            maxRecordCount = Math.max(maxRecordCount, recordsInDay[dateKey].count)
          }

          const startDayIndex = Math.max(
            (dates.value[weekIndex] ?? []).findIndex((day) => dayjs(day).isSame(recordStart, 'day')),
            0,
          )
          const endDayIndex = Math.max(
            (dates.value[weekIndex] ?? []).findIndex((day) => dayjs(day).isSame(recordEnd, 'day')),
            0,
          )

          // The left and width of the record is calculated based on the start and end day index
          const style: Partial<CSSStyleDeclaration> = {
            left: `${startDayIndex * perWidth}px`,
            width: `${(endDayIndex - startDayIndex + 1) * perWidth}px`,
          }

          // The top is calculated from the week index and the record index
          // If the record in 1st week and no record in that date them the top will be 0
          // If the record in 1st week and 1 record in that date then the top will be perRecordHeight + spaceBetweenRecords
          const top = weekIndex * perHeight + spaceBetweenRecords + Math.max(maxRecordCount - 1, 0) * (perRecordHeight + 4)
          const heightRequired = perRecordHeight * Math.max(maxRecordCount, 0) + spaceBetweenRecords + 12

          let position = 'rounded'
          // Here we are checking if the startDay is before all the dates shown in UI rather that the current month
          const isStartMonthBeforeCurrentWeek = dates.value[weekIndex - 1]
            ? dayjs(dates.value[weekIndex - 1][0]).isBefore(startDate, 'month')
            : false

          if (startDate.isSame(currentWeekStart, 'week') && endDate.isSame(currentWeekEnd, 'week')) {
            position = 'rounded'
          } else if (startDate.isSame(recordStart, 'week')) {
            if (isStartMonthBeforeCurrentWeek) {
              if (endDate.isSame(currentWeekEnd, 'week')) {
                position = 'rounded'
              } else position = 'leftRounded'
            } else position = 'leftRounded'
          } else if (endDate.isSame(currentWeekEnd, 'week')) {
            position = 'rightRounded'
          } else {
            position = 'none'
          }

          // If the height required is more than the height of the week, we hide the record
          // and update the recordsInDay object for all the spanned days
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
              id,
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

const calculateNewRow = (event: MouseEvent, updateSideBar?: boolean, skipChangeCheck?: boolean) => {
  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height
  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value?.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value?.rowMeta.range?.fk_to_col

  if (!fromCol) return { newRow: null, updateProperty: [] }

  const week = Math.floor(percentY * dates.value.length)
  const day = Math.floor(percentX * maxVisibleDays.value)

  let newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null
  if (!newStartDate) return { newRow: null, updateProperty: [] }

  let fromDate = dayjs(dragRecord.value.row[fromCol.title!])
  if (!fromDate.isValid()) {
    fromDate = dayjs()
  }

  newStartDate = newStartDate.add(fromDate.hour(), 'hour').add(fromDate.minute(), 'minute').add(fromDate.second(), 'second')

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value?.row,
      [fromCol!.title!]: dayjs(newStartDate).format(updateFormat.value),
    },
  }

  const updateProperty = [fromCol!.title!]

  if (toCol) {
    const fromDate = dragRecord.value?.row[fromCol!.title!] ? dayjs(dragRecord.value.row[fromCol!.title!]) : null
    const toDate = dragRecord.value?.row[toCol!.title!] ? dayjs(dragRecord.value?.row[toCol!.title!]) : null

    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol!.title!] = dayjs(endDate).format(updateFormat.value)
    updateProperty.push(toCol!.title!)
  }

  // If from and to columns of the dragRecord and the newRow are the same, we don't manipulate the formattedRecords and formattedSideBarData. This removes unwanted computation
  if (dragRecord.value.row[fromCol.title!] === newRow.row[fromCol.title!] && !skipChangeCheck) {
    return { newRow: null, updatedProperty: [] }
  }

  if (!newRow) return { newRow: null, updateProperty: [] }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

  if (updateSideBar) {
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })
  } else {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk === newPk ? newRow : r
    })
  }

  return {
    newRow,
    updateProperty,
  }
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !dragRecord.value) return
  calculateNewRow(event, false)
}

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !resizeRecord.value) return

  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height
  const percentX = (event.clientX - left - window.scrollX) / width

  const ogEndDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_to_col!.title!]
  const ogStartDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_from_col!.title!]

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col

  const week = Math.floor(percentY * dates.value.length)
  const day = Math.floor(percentX * maxVisibleDays.value)

  let updateProperty: string[] = []
  let newRow: Row

  if (resizeDirection.value === 'right') {
    let newEndDate = dates.value[week] ? dayjs(dates.value[week][day]).endOf('day') : null
    updateProperty = [toCol!.title!]

    if (dayjs(newEndDate).isBefore(ogStartDate)) {
      newEndDate = dayjs(ogStartDate).clone().endOf('day')
    }

    if (!newEndDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol!.title!]: dayjs(newEndDate).format(updateFormat.value),
      },
    }
  } else {
    let newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null
    updateProperty = [fromCol!.title!]

    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(ogEndDate).clone()
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol!.title!]: dayjs(newStartDate).format(updateFormat.value),
      },
    }
  }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)

    return pk === newPk ? newRow : r
  })

  if (newRow) {
    useDebouncedRowUpdate(newRow, updateProperty, false)
  }
}

const onResizeEnd = () => {
  resizeInProgress.value = false
  resizeDirection.value = undefined
  resizeRecord.value = undefined

  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit') || draggingId.value) return

  if (record.rowMeta.range?.is_readonly) return

  // selectedDate.value = null
  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const stopDrag = (event: MouseEvent) => {
  clearTimeout(dragTimeout.value)
  if (!isUIAllowed('dataEdit') || !dragRecord.value || !isDragging.value) return
  if (dragRecord.value.rowMeta.range?.is_readonly) return

  event.preventDefault()
  dragElement.value!.style.boxShadow = 'none'

  const { newRow, updateProperty } = calculateNewRow(event, false, true)

  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    isDragging.value = false
    draggingId.value = null
    dragElement.value = null
  }

  dragRecord.value = undefined
  updateRowProperty(newRow, updateProperty, false)
  focusedDate.value = null

  $e('c:calendar:month:drag-record')

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (resizeInProgress.value || !record.rowMeta.id) return
  let target = event.target as HTMLElement
  isDragging.value = false

  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    if (record.rowMeta.range?.is_readonly) return
    isDragging.value = true

    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    const allRecords = document.querySelectorAll('.draggable-record')
    allRecords.forEach((el) => {
      if (!el.getAttribute('data-unique-id').includes(record.rowMeta.id!)) {
        el.style.opacity = '30%'
      }
    })

    // selectedDate.value = null

    isDragging.value = true
    dragElement.value = target
    draggingId.value = record.rowMeta!.id!
    dragRecord.value = record

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 200)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value)
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emit('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit')) return
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
      isWithoutDates,
    }: {
      record: Row
      isWithoutDates: boolean
    } = JSON.parse(data)

    if (record.rowMeta.range?.is_readonly) return

    dragRecord.value = record

    const { newRow, updateProperty } = calculateNewRow(event, isWithoutDates)

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
    $e('c:calendar:day:drag-record')
  }
}

const selectDate = (date: dayjs.Dayjs) => {
  dragRecord.value = undefined
  draggingId.value = null
  resizeRecord.value = undefined
  resizeInProgress.value = false
  resizeDirection.value = undefined
  focusedDate.value = null
  selectedDate.value = date
}

const viewMore = (date: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedDate' as const
  selectedDate.value = date
  showSideMenu.value = true
}

const isDateSelected = (date: dayjs.Dayjs) => {
  if (!selectedDate.value) return false
  return dayjs(date).isSame(selectedDate.value, 'day')
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const addRecord = (date: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value) return
  const fromCol = calendarRange.value[0].fk_from_col
  if (!fromCol) return
  const newRecord = {
    row: {
      [fromCol.title!]: date.format(updateFormat.value),
    },
  }
  emit('newRecord', newRecord)
}
</script>

<template>
  <div v-if="calendarRange" class="h-full prevent-select relative" data-testid="nc-calendar-month-view">
    <div
      class="grid"
      :class="{
        'grid-cols-7': maxVisibleDays === 7,
        'grid-cols-5': maxVisibleDays === 5,
      }"
    >
      <div
        v-for="(day, index) in days"
        :key="index"
        class="text-center bg-gray-50 py-1 border-r-1 last:border-r-0 border-gray-200 font-semibold leading-4 uppercase text-[10px] text-gray-500"
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
      class="grid"
      style="height: calc(100% - 1.59rem)"
      @drop="dropEvent"
    >
      <div
        v-for="(week, weekIndex) in dates"
        :key="weekIndex"
        :class="{
          'grid-cols-7': maxVisibleDays === 7,
          'grid-cols-5': maxVisibleDays === 5,
        }"
        class="grid grow"
        data-testid="nc-calendar-month-week"
      >
        <template v-for="(day, dateIndex) in week">
          <div
            v-if="maxVisibleDays === 5 ? day.get('day') !== 0 && day.get('day') !== 6 : true"
            :key="`${weekIndex}-${dateIndex}`"
            :class="{
              'border-brand-500 border-1 !border-r-1 border-b-1':
                isDateSelected(day) || (focusedDate && dayjs(day).isSame(focusedDate, 'day')),
              '!text-gray-400': !isDayInPagedMonth(day),
              '!bg-gray-50 !hover:bg-gray-100': day.get('day') === 0 || day.get('day') === 6,
              'border-t-1': weekIndex === 0,
            }"
            class="text-right relative group last:border-r-0 transition text-sm h-full border-r-1 border-b-1 border-gray-200 font-medium hover:bg-gray-50 text-gray-800 bg-white"
            data-testid="nc-calendar-month-day"
            @click="selectDate(day)"
            @dblclick="addRecord(day)"
          >
            <div v-if="isUIAllowed('dataEdit')" class="flex justify-between p-1">
              <span
                :class="{
                  'block group-hover:hidden': !isDateSelected(day) && [UITypes.DateTime, UITypes.Date].includes(calDataType),
                  'hidden': isDateSelected(day) && [UITypes.DateTime, UITypes.Date].includes(calDataType),
                }"
              ></span>

              <NcDropdown v-if="calendarRange.length > 1" auto-close>
                <NcButton
                  :class="{
                    '!block': isDateSelected(day),
                    '!hidden': !isDateSelected(day),
                  }"
                  class="!group-hover:block rounded"
                  size="small"
                  type="secondary"
                >
                  <component :is="iconMap.plus" class="h-4 w-4" />
                </NcButton>
                <template #overlay>
                  <NcMenu class="w-64">
                    <NcMenuItem> Select date field to add </NcMenuItem>
                    <NcMenuItem
                      v-for="(range, index) in calendarRange"
                      :key="index"
                      class="text-gray-800 font-semibold text-sm"
                      @click="
                      () => {
                        const record = {
                          row: {
                            [range.fk_from_col!.title!]: dayjs(day).format('YYYY-MM-DD HH:mm:ssZ'),
                          },
                        }
                        emit('newRecord', record)
                      }
                    "
                    >
                      <div class="flex items-center gap-1">
                        <LazySmartsheetHeaderCellIcon :column-meta="range.fk_from_col" />
                        <span class="ml-1">{{ range.fk_from_col!.title }}</span>
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
              <NcButton
                v-else-if="[UITypes.DateTime, UITypes.Date].includes(calDataType)"
                :class="{
                  '!block': isDateSelected(day),
                  '!hidden': !isDateSelected(day),
                }"
                class="!group-hover:block !w-6 !h-6 !rounded"
                size="xsmall"
                type="secondary"
                @click="
                () => {
                  const record = {
                    row: {
                      [calendarRange[0].fk_from_col!.title!]: (day).format('YYYY-MM-DD HH:mm:ssZ'),
                    },
                  }
                  emit('newRecord', record)
                }
              "
              >
                <component :is="iconMap.plus" />
              </NcButton>
              <span
                :class="{
                  'bg-brand-50 text-brand-500 !font-bold': day.isSame(dayjs(), 'date'),
                }"
                class="px-1.3 py-1 text-sm leading-3 font-medium rounded-lg"
              >
                {{ day.format('DD') }}
              </span>
            </div>
            <div v-if="!isUIAllowed('dataEdit')" class="leading-3 p-3">{{ dayjs(day).format('DD') }}</div>

            <NcButton
              v-if="
                recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')] &&
                recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflow &&
                !draggingId
              "
              v-e="`['c:calendar:month-view-more']`"
              class="!absolute bottom-1 right-1 text-center min-w-4.5 mx-auto z-3 text-gray-500"
              size="xxsmall"
              type="secondary"
              @click="viewMore(day)"
            >
              <span class="text-xs px-1"> + {{ recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflowCount }} </span>
            </NcButton>
          </div>
        </template>
      </div>
    </div>
    <div class="absolute inset-0 pointer-events-none mt-8 pb-7.5" data-testid="nc-calendar-month-record-container">
      <template v-for="(record, recordIndex) in recordsToDisplay.records" :key="recordIndex">
        <div
          v-if="record.rowMeta.style?.display !== 'none'"
          :data-testid="`nc-calendar-month-record-${record.row[displayField!.title!]}`"
          :data-unique-id="record.rowMeta.id"
          :style="{
            ...record.rowMeta.style,
            zIndex: record.rowMeta.id === draggingId ? 100 : 0,
          }"
          class="absolute group draggable-record transition cursor-pointer pointer-events-auto"
          @mouseleave="hoverRecord = null"
          @mouseover="hoverRecord = record.rowMeta.id"
          @mousedown.stop="dragStart($event, record)"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :hover="hoverRecord === record.rowMeta.id || record.rowMeta.id === draggingId"
              :position="record.rowMeta.position"
              :record="record"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              :selected="dragRecord?.rowMeta?.id === record.rowMeta.id || resizeRecord?.rowMeta?.id === record.rowMeta.id"
              @resize-start="onResizeStart"
            >
              <template v-if="[UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime].includes(calDataType)" #time>
                <span class="text-xs font-medium text-gray-400">
                  {{ dayjs(record.row[record.rowMeta.range?.fk_from_col!.title!]).format('h:mma').slice(0, -1) }}
                </span>
              </template>
              <template v-for="(field, id) in fields" :key="id">
                <LazySmartsheetPlainCell
                  v-if="!isRowEmpty(record, field!)"
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="getFieldStyle(field).bold"
                  :column="field"
                  :italic="getFieldStyle(field).italic"
                  :underline="getFieldStyle(field).underline"
                />
              </template>
            </LazySmartsheetCalendarRecordCard>
          </LazySmartsheetRow>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prevent-select {
  -webkit-user-select: none; /* Safari */
  -ms-user-select: none; /* IE 10 and IE 11 */
  user-select: none; /* Standard syntax */
}

.grid-cols-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
</style>

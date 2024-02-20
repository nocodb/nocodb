<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row } from '~/lib'
import { computed, ref } from '#imports'
import { generateRandomNumber, getScrollbarWidth, isRowEmpty } from '~/utils'

const emits = defineEmits(['expandRecord'])

const {
  selectedDateRange,
  formattedData,
  formattedSideBarData,
  calendarRange,
  displayField,
  selectedTime,
  selectedDate,
  updateRowProperty,
  sideBarFilterOption,
  showSideMenu,
} = useCalendarViewStoreOrThrow()

const container = ref<null | HTMLElement>(null)

const { width: containerWidth } = useElementSize(container)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

// Since it is a datetime Week view, we need to create a 2D array of dayjs objects to represent the hours in a day for each day in the week
const datesHours = computed(() => {
  const datesHours: Array<Array<dayjs.Dayjs>> = []
  let startOfWeek = dayjs(selectedDateRange.value.start) ?? dayjs().startOf('week')
  const endOfWeek = dayjs(selectedDateRange.value.end) ?? dayjs().endOf('week')

  while (startOfWeek.isSameOrBefore(endOfWeek)) {
    const hours: Array<dayjs.Dayjs> = []
    for (let i = 0; i < 24; i++) {
      hours.push(
        dayjs()
          .hour(i)
          .minute(0)
          .second(0)
          .millisecond(0)
          .year(startOfWeek.year())
          .month(startOfWeek.month())
          .date(startOfWeek.date()),
      )
    }
    datesHours.push(hours)
    startOfWeek = startOfWeek.add(1, 'day')
  }
  return datesHours
})

const recordsAcrossAllRange = computed<{
  records: Array<Row>
  count: {
    [key: string]: {
      [key: string]: {
        id: Array<string>
        overflow: boolean
        overflowCount: number
      }
    }
  }
}>(() => {
  if (!formattedData.value || !calendarRange.value || !container.value) return { records: [], count: {} }

  const { scrollHeight } = container.value

  const perWidth = containerWidth.value / 7
  const perHeight = scrollHeight / 24

  const scheduleStart = dayjs(selectedDateRange.value.start).startOf('day')
  const scheduleEnd = dayjs(selectedDateRange.value.end).endOf('day')

  // We need to keep track of the overlaps for each day and hour in the week to calculate the width and left position of each record
  // The first key is the date, the second key is the hour, and the value is an object containing the ids of the records that overlap
  // The key is in the format YYYY-MM-DD and the hour is in the format HH:mm
  const overlaps: {
    [key: string]: {
      [key: string]: {
        id: Array<string>
        overflow: boolean
        overflowCount: number
      }
    }
  } = {}

  let recordsToDisplay: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col

    // We fetch all the records that match the calendar ranges in a single time.
    // But not all fetched records are valid for the certain range, so we filter them out & sort them
    const sortedFormattedData = [...formattedData.value].filter((record) => {
      const fromDate = record.row[fromCol!.title!] ? dayjs(record.row[fromCol!.title!]) : null

      if (fromCol && toCol) {
        const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        const toDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

        return fromDate && toDate && !toDate.isBefore(fromDate)
      } else if (fromCol && !toCol) {
        return !!fromDate
      }
      return false
    })

    sortedFormattedData.forEach((record: Row) => {
      if (!toCol && fromCol) {
        // If there is no toColumn chosen in the range
        const startDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        if (!startDate) return

        // Hour Key currently is set as start of the hour
        // TODO:  Need to work on the granularity of the hour
        const dateKey = startDate?.format('YYYY-MM-DD')
        const hourKey = startDate?.startOf('hour').format('HH:mm')

        const id = record.rowMeta.id ?? generateRandomNumber()

        let style: Partial<CSSStyleDeclaration> = {}

        // If the dateKey and hourKey are valid, we add the id to the overlaps object
        if (dateKey && hourKey) {
          if (!overlaps[dateKey]) {
            overlaps[dateKey] = {}
          }
          if (!overlaps[dateKey][hourKey]) {
            overlaps[dateKey][hourKey] = {
              id: [],
              overflow: false,
              overflowCount: 0,
            }
          }
          overlaps[dateKey][hourKey].id.push(id)
        }

        // If the number of records that overlap in a single hour is more than 4, we hide the record and set the overflow flag to true
        // We also keep track of the number of records that overflow
        if (overlaps[dateKey][hourKey].id.length > 4) {
          overlaps[dateKey][hourKey].overflow = true
          style.display = 'none'
          overlaps[dateKey][hourKey].overflowCount += 1
        }

        // TODO: dayIndex is not calculated perfectly
        // Should revisit this part in next iteration
        let dayIndex = dayjs(dateKey).day() - 1
        if (dayIndex === -1) {
          dayIndex = 6
        }

        // We calculate the index of the hour in the day and set the top and height of the record
        const hourIndex = Math.max(
          datesHours.value[dayIndex].findIndex((h) => h.startOf('hour').format('HH:mm') === hourKey),
          0,
        )

        style = {
          ...style,
          top: `${hourIndex * perHeight}px`,
          height: `${perHeight / 1.5}px`,
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            id,
            position: 'rounded',
            style,
            range,
            dayIndex,
          },
        })
      } else if (fromCol && toCol) {
        const id = record.rowMeta.id ?? generateRandomNumber()

        let startDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        let endDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

        // If the start date is not valid, we skip the record
        if (!startDate?.isValid()) return

        // If the end date is not valid, we set it to 30 minutes after the start date
        if (!endDate?.isValid()) {
          endDate = startDate.clone().add(30, 'minutes')
        }

        // If the start date is before the start of the schedule, we set it to the start of the schedule
        // If the end date is after the end of the schedule, we set it to the end of the schedule
        // This is to ensure that the records are within the bounds of the schedule and do not overflow
        if (startDate.isBefore(scheduleStart, 'minutes')) {
          startDate = scheduleStart
        }
        if (endDate.isAfter(scheduleEnd, 'minutes')) {
          endDate = scheduleEnd
        }

        // Setting the current start date to the start date of the record
        let currentStartDate: dayjs.Dayjs = startDate.clone()

        // We loop through the start date to the end date and create a record for each day as it spans bottom to top
        while (currentStartDate.isSameOrBefore(endDate!, 'day')) {
          const currentEndDate = currentStartDate.clone().endOf('day')
          const recordStart: dayjs.Dayjs = currentEndDate.isSame(startDate, 'day') ? startDate : currentStartDate
          const recordEnd = currentEndDate.isSame(endDate, 'day') ? endDate : currentEndDate

          const dateKey = recordStart.format('YYYY-MM-DD')

          // TODO: dayIndex is not calculated perfectly
          // Should revisit this part in next iteration
          let dayIndex = recordStart.day() - 1
          if (dayIndex === -1) {
            dayIndex = 6
          }

          // We calculate the index of the start and end hour in the day
          const startHourIndex = Math.max(
            (datesHours.value[dayIndex] ?? []).findIndex((h) => h.format('HH:mm') === recordStart.format('HH:mm')),
            0,
          )
          const endHourIndex = Math.max(
            (datesHours.value[dayIndex] ?? []).findIndex((h) => h.format('HH:mm') === recordEnd?.startOf('hour').format('HH:mm')),
            0,
          )

          let position: 'topRounded' | 'bottomRounded' | 'rounded' | 'none' = 'rounded'
          const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(currentStartDate, 'day')
          const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(currentStartDate, 'day')
          const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(currentStartDate, 'day')

          if (isSelectedDay(startDate) && isSelectedDay(endDate)) {
            position = 'rounded'
          } else if (isBeforeSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
            position = 'none'
          } else if (isSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
            position = 'topRounded'
          } else if (isBeforeSelectedDay(startDate) && isSelectedDay(endDate)) {
            position = 'bottomRounded'
          } else {
            position = 'none'
          }

          let _startHourIndex = startHourIndex

          let style: Partial<CSSStyleDeclaration> = {}

          // We loop through the start hour index to the end hour index and add the id to the overlaps object
          while (_startHourIndex <= endHourIndex) {
            const hourKey = datesHours.value[dayIndex][_startHourIndex].format('HH:mm')
            if (!overlaps[dateKey]) {
              overlaps[dateKey] = {}
            }
            if (!overlaps[dateKey][hourKey]) {
              overlaps[dateKey][hourKey] = {
                id: [],
                overflow: false,
                overflowCount: 0,
              }
            }
            overlaps[dateKey][hourKey].id.push(id)

            // If the number of records that overlap in a single hour is more than 4, we hide the record and set the overflow flag to true
            // We also keep track of the number of records that overflow
            if (overlaps[dateKey][hourKey].id.length > 4) {
              overlaps[dateKey][hourKey].overflow = true
              style.display = 'none'
              overlaps[dateKey][hourKey].overflowCount += 1
            }

            _startHourIndex++
          }

          const spanHours = endHourIndex - startHourIndex + 1

          const top = startHourIndex * perHeight

          const height = (endHourIndex - startHourIndex + 1) * perHeight - spanHours - 5

          style = {
            ...style,
            top: `${top}px`,
            height: `${height}px`,
          }

          recordsToDisplay.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              id,
              style,
              range,
              position,
              dayIndex,
            },
          })
          // We set the current start date to the next day
          currentStartDate = currentStartDate.add(1, 'day').hour(0).minute(0)
        }
      }
    })

    // With can't find the left and width of the record without knowing the overlaps
    // Hence the first iteration is to find the overlaps, top, height and then the second iteration is to find the left and width
    // This is because the left and width of the record depends on the overlaps

    recordsToDisplay = recordsToDisplay.map((record) => {
      // maxOverlaps is the maximum number of records that overlap in a single hour
      // overlapIndex is the index of the record in the overlaps object
      let maxOverlaps = 1
      let overlapIndex = 0
      const dayIndex = record.rowMeta.dayIndex as number

      const dateKey = dayjs(selectedDateRange.value.start).add(dayIndex, 'day').format('YYYY-MM-DD')
      for (const hours in overlaps[dateKey]) {
        // We are checking if the overlaps object contains the id of the record
        // If it does, we set the maxOverlaps and overlapIndex
        if (overlaps[dateKey][hours].id.includes(record.rowMeta.id!)) {
          maxOverlaps = Math.max(maxOverlaps, overlaps[dateKey][hours].id.length - overlaps[dateKey][hours].overflowCount)
          overlapIndex = Math.max(overlapIndex, overlaps[dateKey][hours].id.indexOf(record.rowMeta.id!))
        }
      }
      const spacing = 1
      const widthPerRecord = (100 - spacing * (maxOverlaps - 1)) / maxOverlaps / 7
      const leftPerRecord = widthPerRecord * overlapIndex

      record.rowMeta.style = {
        ...record.rowMeta.style,
        left: `calc(${dayIndex * perWidth}px + ${leftPerRecord}%)`,
        width: `calc(${widthPerRecord}%)`,
      }
      return record
    })
  })

  return {
    records: recordsToDisplay,
    count: overlaps,
  }
})

const dragElement = ref<HTMLElement | null>(null)

const resizeInProgress = ref(false)

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const hoverRecord = ref<string | null>()

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>()

const isDragging = ref(false)

const dragRecord = ref<Row>()

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !resizeRecord.value) return

  const { width, left, top, bottom } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  // If the mouse is near the bottom of the container, we scroll down
  // If the mouse is near the top of the container, we scroll up
  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  // We calculate the percentage of the mouse position in the container
  // percentX is used for the day and percentY is used for the hour
  const percentX = (event.clientX - left - window.scrollX) / width
  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol || !toCol) return

  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title!])
  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title!])

  const day = Math.floor(percentX * 7)
  const hour = Math.floor(percentY * 23)

  let updateProperty: string[] = []
  let newRow: Row

  if (resizeDirection.value === 'right') {
    let newEndDate = dayjs(selectedDateRange.value.start).add(day, 'day').add(hour, 'hour')
    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we set the new end date to the start date
    if (dayjs(newEndDate).isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone()
    }

    if (!newEndDate.isValid()) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }
  } else if (resizeDirection.value === 'left') {
    let newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day').add(hour, 'hour')
    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we set the new start date to the end date
    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone()
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }
  }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)
    return pk === newPk ? newRow : r
  })
  useDebouncedRowUpdate(newRow, updateProperty, false)
}

const onResizeEnd = () => {
  resizeInProgress.value = false
  resizeDirection.value = null
  resizeRecord.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}
const onResizeStart = (direction: 'right' | 'left', event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

// We calculate the new row based on the mouse position and update the record
// We also update the sidebar data if the dropped from the sidebar
const calculateNewRow = (event: MouseEvent, updateSideBar?: boolean) => {
  const { width, left, top } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  const percentX = (event.clientX - left - window.scrollX) / width
  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return

  const day = Math.floor(percentX * 7)
  const hour = Math.floor(percentY * 23)

  const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day').add(hour, 'hour')
  if (!newStartDate) return

  let endDate
  const updatedProperty = [fromCol.title!]

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? dayjs(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!] ? dayjs(dragRecord.value.row[toCol.title!]) : null

    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')
    updatedProperty.push(toCol.title!)
  }

  if (!newRow) return { newRow: null, updatedProperty }

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

  return { newRow, updatedProperty }
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !dragRecord.value) return
  const { top, bottom } = container.value.getBoundingClientRect()

  // If the mouse is near the bottom of the container, we scroll down
  // If the mouse is near the top of the container, we scroll up
  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  calculateNewRow(event)
}

const stopDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !isDragging.value || !container.value || !dragRecord.value) return

  event.preventDefault()
  clearTimeout(dragTimeout.value!)

  const { newRow, updatedProperty } = calculateNewRow(event, false)

  // We set the visibility and opacity of the records back to normal
  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value = null
  }

  updateRowProperty(newRow, updatedProperty, false)

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  if (resizeInProgress.value) return
  let target = event.target as HTMLElement

  isDragging.value = false

  dragTimeout.value = setTimeout(() => {
    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    const allRecords = document.querySelectorAll('.draggable-record')
    allRecords.forEach((el) => {
      if (!el.getAttribute('data-unique-id').includes(record.rowMeta.id!)) {
        // el.style.visibility = 'hidden'
        el.style.opacity = '30%'
      }
    })

    dragRecord.value = record

    isDragging.value = true
    dragElement.value = target
    dragRecord.value = record

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 200)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value!)
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emits('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value) return
  event.preventDefault()

  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
    }: {
      record: Row
    } = JSON.parse(data)

    dragRecord.value = record

    const { newRow, updatedProperty } = calculateNewRow(event, true)

    updateRowProperty(newRow, updatedProperty, false)
  }
}

const viewMore = (hour: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedHours'
  selectedTime.value = hour
  showSideMenu.value = true
}
</script>

<template>
  <div class="w-full relative prevent-select" data-testid="nc-calendar-week-view" @drop="dropEvent">
    <div class="flex absolute bg-gray-50 w-full top-0">
      <div
        v-for="date in datesHours"
        :key="date[0].toISOString()"
        :class="{
          'text-brand-500': date[0].isSame(dayjs(), 'date'),
          'last:mr-2.75': getScrollbarWidth() > 0,
        }"
        class="w-1/7 text-center text-sm text-gray-500 w-full py-1 border-gray-200 last:border-r-0 border-b-1 border-l-1 bg-gray-50"
      >
        {{ dayjs(date[0]).format('DD ddd') }}
      </div>
    </div>
    <div ref="container" class="h-[calc(100vh-11.7rem)] relative flex w-full mt-7.1 overflow-y-auto nc-scrollbar-md">
      <div v-for="(date, index) in datesHours" :key="index" class="h-full w-1/7" data-testid="nc-calendar-week-day">
        <div
          v-for="(hour, hourIndex) in date"
          :key="hourIndex"
          :class="{
            'border-1 !border-brand-500 bg-gray-50': hour.isSame(selectedTime, 'hour'),
            '!border-l-0': date[0].day() === selectedDateRange.start?.day(),
          }"
          class="text-center relative h-20 text-sm text-gray-500 w-full hover:bg-gray-50 py-1 border-gray-200 first:border-l-none border-1 border-r-gray-50 border-t-gray-50"
          data-testid="nc-calendar-week-hour"
          @click="
            () => {
              selectedTime = hour
              selectedDate = hour
            }
          "
        >
          <span v-if="date[0].day() === selectedDateRange.start?.day()" class="absolute text-xs left-1">
            {{ hour.format('h A') }}
          </span>
          <NcButton
            v-if="recordsAcrossAllRange?.count?.[hour.format('YYYY-MM-DD')]?.[hour.format('HH:mm')]?.overflow"
            class="!absolute bottom-1 text-center w-15 ml-auto inset-x-0 z-3 text-gray-500"
            size="xxsmall"
            type="secondary"
            @click="viewMore(hour)"
          >
            <span class="text-xs">
              +
              {{ recordsAcrossAllRange?.count[hour.format('YYYY-MM-DD')][hour.format('HH:mm')]?.overflowCount }}
              more
            </span>
          </NcButton>
        </div>
      </div>

      <div class="absolute pointer-events-none inset-0 !mt-[25px]" data-testid="nc-calendar-week-record-container">
        <div
          v-for="(record, rowIndex) in recordsAcrossAllRange.records"
          :key="rowIndex"
          :data-testid="`nc-calendar-week-record-${record.row[displayField!.title!]}`"
          :data-unique-id="record.rowMeta!.id"
          :style="record.rowMeta!.style"
          class="absolute draggable-record w-1/7 group cursor-pointer pointer-events-auto"
          @mousedown="dragStart($event, record)"
          @mouseleave="hoverRecord = null"
          @mouseover="hoverRecord = record.rowMeta.id"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarVRecordCard
              :hover="hoverRecord === record.rowMeta.id"
              :position="record.rowMeta!.position"
              :record="record"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              color="blue"
              @resize-start="onResizeStart"
            >
              <template v-if="!isRowEmpty(record, displayField)">
                <div
                  :class="{
                    '!mt-2': displayField.uidt === UITypes.SingleLineText,
                    '!mt-1': displayField.uidt === UITypes.MultiSelect || displayField.uidt === UITypes.SingleSelect,
                  }"
                >
                  <LazySmartsheetVirtualCell
                    v-if="isVirtualCol(displayField)"
                    v-model="record.row[displayField.title]"
                    :column="displayField"
                    :row="record"
                  />

                  <LazySmartsheetCell
                    v-else
                    v-model="record.row[displayField.title]"
                    :column="displayField"
                    :edit-enabled="false"
                    :read-only="true"
                  />
                </div>
              </template>
            </LazySmartsheetCalendarVRecordCard>
          </LazySmartsheetRow>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hide {
  transition: 0.01s;
  transform: translateX(-9999px);
}
.prevent-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>

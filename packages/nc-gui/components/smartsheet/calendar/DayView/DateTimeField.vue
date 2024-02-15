<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { type Row, computed, ref } from '#imports'
import { generateRandomNumber, isRowEmpty } from '~/utils'

const emit = defineEmits(['expandRecord', 'new-record'])

const {
  selectedDate,
  selectedTime,
  formattedData,
  calendarRange,
  formattedSideBarData,
  updateRowProperty,
  displayField,
  sideBarFilterOption,
  showSideMenu,
} = useCalendarViewStoreOrThrow()

const container = ref<null | HTMLElement>(null)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []
  const _selectedDate = dayjs(selectedDate.value)

  for (let i = 0; i < 24; i++) {
    hours.push(_selectedDate.clone().startOf('day').add(i, 'hour'))
  }
  return hours
})

const recordsAcrossAllRange = computed<{
  record: Row[]
  count: {
    [key: string]: {
      id: string
      overflow: boolean
      overflowCount: number
    }
  }
}>(() => {
  if (!calendarRange.value || !formattedData.value) return { record: [], count: {} }

  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  // We use this object to keep track of the number of records that overlap at a given time, and if the number of records exceeds 4, we hide the record
  // and show a button to view more records
  // The key is the time in HH:mm format
  // id is the id of the record generated below

  const overlaps: {
    [key: string]: {
      id: string[]
      overflow: boolean
      overflowCount: number
    }
  } = {}

  const perRecordHeight = 80

  let recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col

    // We fetch all the records that match the calendar ranges in a single time.
    // But not all fetched records are valid for the certain range, so we filter them out & sort them
    const sortedFormattedData = [...formattedData.value].filter((record) => {
      const fromDate = record.row[fromCol!.title!] ? dayjs(record.row[fromCol!.title!]) : null

      if (fromCol && endCol) {
        const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        const toDate = record.row[endCol.title!] ? dayjs(record.row[endCol.title!]) : null

        return fromDate && toDate?.isValid() ? fromDate.isBefore(toDate) : true
      } else if (fromCol && !endCol) {
        return !!fromDate
      }
      return false
    })

    // If there is a start and end column, we calculate the top and height of the record based on the start and end date
    if (fromCol && endCol) {
      for (const record of sortedFormattedData) {
        // We use this id during the drag and drop operation and to keep track of the number of records that overlap at a given time
        const id = generateRandomNumber()
        let startDate = dayjs(record.row[fromCol.title!])
        let endDate = dayjs(record.row[endCol.title!])

        // If no start date is provided or startDate is after the endDate, we skip the record
        if (!startDate.isValid() || startDate.isAfter(endDate)) continue

        // If there is no end date, we add 30 minutes to the start date and use that as the end date
        if (!endDate.isValid()) {
          endDate = startDate.clone().add(30, 'minutes')
        }

        // If the start date is before the opened date, we use the schedule start as the start date
        // This is to ensure the generated style of the record is not outside the bounds of the calendar
        if (startDate.isBefore(scheduleStart, 'minutes')) {
          startDate = scheduleStart
        }

        // If the end date is after the schedule end, we use the schedule end as the end date
        // This is to ensure the generated style of the record is not outside the bounds of the calendar
        if (endDate.isAfter(scheduleEnd, 'minutes')) {
          endDate = scheduleEnd
        }

        // The top of the record is calculated based on the start hour and minute
        const topInPixels = (startDate.hour() + startDate.minute() / 60) * 80

        // A minimum height of 80px is set for each record
        // The height of the record is calculated based on the difference between the start and end date
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const startHour = startDate.hour()

        let _startDate = startDate.clone()

        const style: Partial<CSSStyleDeclaration> = {
          height: `${heightInPixels}px`,
          top: `${topInPixels + 5 + startHour * 2}px`,
        }

        // We loop through every 15 minutes between the start and end date and keep track of the number of records that overlap at a given time
        // If the number of records exceeds 4, we hide the record and show a button to view more records
        while (_startDate.isBefore(endDate)) {
          const timeKey = _startDate.format('HH:mm')
          if (!overlaps[timeKey]) {
            overlaps[timeKey] = {
              id: [],
              overflow: false,
              overflowCount: 0,
            }
          }
          overlaps[timeKey].id.push(id)

          // If the number of records exceeds 4, we hide the record mark the time as overflow
          if (overlaps[timeKey].id.length > 4) {
            overlaps[timeKey].overflow = true
            style.display = 'none'
            overlaps[timeKey].overflowCount += 1
          }
          _startDate = _startDate.add(15, 'minutes')
        }

        // This property is used to determine which side the record should be rounded. It can be top, bottom, both or none
        // We use the start and end date to determine the position of the record
        let position = 'none'
        const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(selectedDate.value, 'day')

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

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            position,
            style,
            id,
            range: range as any,
          },
        })
      }
    } else if (fromCol) {
      for (const record of sortedFormattedData) {
        const id = generateRandomNumber()

        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[fromCol.title!]).add(15, 'minutes')

        const startHour = startDate.hour()

        let style: Partial<CSSStyleDeclaration> = {}
        let _startDate = startDate.clone()

        // We loop through every 15 minutes between the start and end date and keep track of the number of records that overlap at a given time
        while (_startDate.isBefore(endDate)) {
          const timeKey = _startDate.startOf('hour').format('HH:mm')

          if (!overlaps[timeKey]) {
            overlaps[timeKey] = {
              id: [],
              overflow: false,
              overflowCount: 0,
            }
          }
          overlaps[timeKey].id.push(id)

          // If the number of records exceeds 8, we hide the record and mark it as overflow
          if (overlaps[timeKey].id.length > 8) {
            overlaps[timeKey].overflow = true
            overlaps[timeKey].overflowCount += 1
            style = {
              ...style,
              display: 'none',
            }
          }
          _startDate = _startDate.add(15, 'minutes')
        }

        const topInPixels = (startDate.hour() + startDate.startOf('hour').minute() / 60) * 80

        // A minimum height of 80px is set for each record
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const finalTopInPixels = topInPixels + startHour * 2

        style = {
          ...style,
          top: `${finalTopInPixels + 2}px`,
          height: `${heightInPixels - 2}px`,
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style,
            id,
            position: 'rounded',
          },
        })
      }
    }
  })

  // We can't calculate the width & left of the records without knowing the number of records that overlap at a given time
  // So we loop through the records again and calculate the width & left of the records based on the number of records that overlap at a given time
  recordsByRange = recordsByRange.map((record) => {
    // MaxOverlaps is the number of records that overlap at a given time
    // overlapIndex is the index of the record in the list of records that overlap at a given time
    let maxOverlaps = 1
    let overlapIndex = 0
    for (const minutes in overlaps) {
      if (overlaps[minutes].id.includes(record.rowMeta.id!)) {
        maxOverlaps = Math.max(maxOverlaps, overlaps[minutes].id.length - overlaps[minutes].overflowCount)
        overlapIndex = Math.max(overlaps[minutes].id.indexOf(record.rowMeta.id!), overlapIndex)
      }
    }

    const spacing = 0.25
    const widthPerRecord = (100 - spacing * (maxOverlaps - 1)) / maxOverlaps

    const leftPerRecord = (widthPerRecord + spacing) * overlapIndex

    record.rowMeta.style = {
      ...record.rowMeta.style,
      left: `${leftPerRecord - 0.08}%`,
      width: `calc(${widthPerRecord}%)`,
    }
    return record
  })

  return {
    count: overlaps,
    record: recordsByRange,
  }
})

const dragRecord = ref<Row | null>(null)

const isDragging = ref(false)

const dragElement = ref<HTMLElement | null>(null)

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>()

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const hoverRecord = ref<string | null>(null)

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

// When the user is dragging a record, we calculate the new start and end date based on the mouse position
const calculateNewRow = (event: MouseEvent) => {
  const { top } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  // We calculate the percentage of the mouse position in the scroll container
  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  // We calculate the hour based on the percentage of the mouse position in the scroll container
  // It can be between 0 and 23 (inclusive)
  const hour = Math.max(Math.floor(percentY * 23), 0)

  // We calculate the new startDate by adding the hour to the start of the selected date
  const newStartDate = dayjs(selectedDate.value).startOf('day').add(hour, 'hour')
  if (!newStartDate || !fromCol) return { newRow: null, updateProperty: [] }

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }

  const updateProperty = [fromCol.title!]

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? dayjs(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!] ? dayjs(dragRecord.value.row[toCol.title!]) : null

    // If there is an end date, we calculate the new end date based on the new start date and add the difference between the start and end date to the new start date
    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'hour'), 'hour')
    } else if (fromDate && !toDate) {
      // If there is no end date, we set the end date to the end of the day
      endDate = dayjs(newStartDate).endOf('hour')
    } else if (!fromDate && toDate) {
      // If there is no start date, we set the end date to the end of the day
      endDate = dayjs(newStartDate).endOf('hour')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')

    updateProperty.push(toCol.title!)
  }

  if (!newRow) {
    return { newRow: null, updateProperty: [] }
  }

  // We use the primary key of the new row to find the old row in the formattedData array
  // If the old row is found, we replace it with the new row in the formattedData array
  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  if (dragElement.value) {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      if (pk === newPk) {
        return newRow
      }
      return r
    })
  } else {
    // If the old row is not found, we add the new row to the formattedData array and remove the old row from the formattedSideBarData array
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })
  }
  return { newRow, updateProperty }
}

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !resizeRecord.value) return
  const { top, bottom } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  // If the mouse position is near the top or bottom of the scroll container, we scroll the container
  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col
  if (!fromCol || !toCol) return

  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title!])
  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title!])

  const hour = Math.max(Math.floor(percentY * 23), 0)

  let newRow
  let updateProperty: string[] = []

  if (resizeDirection.value === 'right') {
    // If the user is resizing the record to the right, we calculate the new end date based on the mouse position
    let newEndDate = dayjs(selectedDate.value).add(hour, 'hour')

    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we set the new end date to the start date
    // This is to ensure the end date is always same or after the start date
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
    let newStartDate = dayjs(selectedDate.value).add(hour, 'hour')

    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we set the new start date to the end date
    // This is to ensure the start date is always before or same the end date
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
    if (pk === newPk) {
      return newRow
    }
    return r
  })
  useDebouncedRowUpdate(newRow, updateProperty, false)
}

const onResizeEnd = () => {
  resizeDirection.value = null
  resizeRecord.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', _event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !dragRecord.value) return

  const { top, bottom } = container.value.getBoundingClientRect()

  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }
  calculateNewRow(event)
}

const stopDrag = (event: MouseEvent) => {
  event.preventDefault()
  clearTimeout(dragTimeout.value!)
  if (!isUIAllowed('dataEdit') || !isDragging.value || !container.value || !dragRecord.value) return

  const { newRow, updateProperty } = calculateNewRow(event)
  if (!newRow && !updateProperty) return

  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value = null
  }

  updateRowProperty(newRow, updateProperty, false)

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  let target = event.target as HTMLElement

  isDragging.value = false

  // We use a timeout to determine if the user is dragging or clicking on the record
  dragTimeout.value = setTimeout(() => {
    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    // When the user starts dragging a record, we reduce opacity of all other records
    const allRecords = document.querySelectorAll('.draggable-record')
    allRecords.forEach((el) => {
      if (!el.getAttribute('data-unique-id').includes(record.rowMeta.id!)) {
        // el.style.visibility = 'hidden'
        el.style.opacity = '30%'
      }
    })

    dragRecord.value = record

    dragElement.value = target
    dragRecord.value = record

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 200)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value!)
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emit('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const viewMore = (hour: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedHours'
  selectedTime.value = hour
  showSideMenu.value = true
}
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.record.length"
    ref="container"
    class="w-full relative no-selection h-[calc(100vh-10rem)] overflow-y-auto nc-scrollbar-md"
    data-testid="nc-calendar-day-view"
  >
    <div
      v-for="(hour, index) in hours"
      :key="index"
      :class="{
        '!border-brand-500': hour.isSame(selectedTime),
      }"
      class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
      data-testid="nc-calendar-day-hour"
      @click="selectedTime = hour"
    >
      <div class="pt-2 px-4 text-xs text-gray-500 font-semibold h-20">
        {{ dayjs(hour).format('H A') }}
      </div>
      <div></div>
      <NcDropdown
        v-if="calendarRange.length > 1"
        :class="{
          '!block': hour.isSame(selectedTime),
          '!hidden': !hour.isSame(selectedTime),
        }"
        auto-close
      >
        <NcButton
          class="!group-hover:block mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
          size="xsmall"
          type="secondary"
        >
          <component :is="iconMap.plus" class="h-4 w-4" />
        </NcButton>
        <template #overlay>
          <NcMenu class="w-64">
            <NcMenuItem> Select date field to add </NcMenuItem>
            <NcMenuItem
              v-for="(range, calIndex) in calendarRange"
              :key="calIndex"
              class="text-gray-800 font-semibold text-sm"
              @click="
                () => {
                  let record = {
                    row: {
                      [range.fk_from_col!.title!]: hour.format('YYYY-MM-DD HH:mm:ssZ'),
                    },
                  }
                  if (range.fk_to_col) {
                    record = {
                      row: {
                        ...record.row,
                        [range.fk_to_col!.title!]: hour.add(1, 'hour').format('YYYY-MM-DD HH:mm:ssZ'),
                      },
                    }
                  }
                  emit('new-record', record)
                }
              "
            >
              <div class="flex items-center gap-1">
                <LazySmartsheetHeaderCellIcon :column-meta="range.fk_from_col" />
                <span class="ml-1">{{ range.fk_from_col!.title! }}</span>
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>
      <NcButton
        v-else
        :class="{
          '!block': hour.isSame(selectedTime),
          '!hidden': !hour.isSame(selectedTime),
        }"
        class="!group-hover:block mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
        size="xsmall"
        type="secondary"
        @click="
          () => {
            let record = {
              row: {
                [calendarRange[0].fk_from_col!.title!]: hour.format('YYYY-MM-DD HH:mm:ssZ'),
              },
            }

            if (calendarRange[0].fk_to_col) {
              record = {
                row: {
                  ...record.row,
                  [calendarRange[0].fk_to_col!.title!]: hour.add(1, 'hour').format('YYYY-MM-DD HH:mm:ssZ'),
                },
              }
            }
            emit('new-record', record)
          }
        "
      >
        <component :is="iconMap.plus" class="h-4 w-4" />
      </NcButton>

      <NcButton
        v-if="recordsAcrossAllRange?.count?.[hour.format('HH:mm')]?.overflow"
        class="!absolute bottom-2 text-center w-15 mx-auto inset-x-0 z-3 text-gray-500"
        size="xxsmall"
        type="secondary"
        @click="viewMore(hour)"
      >
        <span class="text-xs">
          +
          {{ recordsAcrossAllRange?.count[hour.format('HH:mm')]?.overflowCount }}
          more
        </span>
      </NcButton>
    </div>
    <div class="absolute inset-0 pointer-events-none">
      <div class="relative !ml-[60px]" data-testid="nc-calendar-day-record-container">
        <div
          v-for="(record, rowIndex) in recordsAcrossAllRange.record"
          :key="rowIndex"
          :data-testid="`nc-calendar-day-record-${record.row[displayField!.title!]}`"
          :data-unique-id="record.rowMeta.id"
          :style="record.rowMeta.style"
          class="absolute draggable-record group cursor-pointer pointer-events-auto"
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

  <div v-else class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">No records in this day</div>
</template>

<style lang="scss" scoped>
.no-selection {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>

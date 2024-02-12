<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row } from '~/lib'
import { ref } from '#imports'
import { generateRandomNumber, isRowEmpty } from '~/utils'

const emits = defineEmits(['expandRecord'])

const { selectedDateRange, formattedData, formattedSideBarData, calendarRange, selectedDate, displayField, updateRowProperty } =
  useCalendarViewStoreOrThrow()

const container = ref<null | HTMLElement>(null)

const { width: containerWidth } = useElementSize(container)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const weekDates = computed(() => {
  const startOfWeek = new Date(selectedDateRange.value.start!)
  const endOfWeek = new Date(selectedDateRange.value.end!)
  const datesArray = []
  while (startOfWeek.getTime() <= endOfWeek.getTime()) {
    datesArray.push(new Date(startOfWeek))
    startOfWeek.setDate(startOfWeek.getDate() + 1)
  }
  return datesArray
})

const findFirstSuitableColumn = (recordsInDay: any, startDayIndex: number, spanDays: number) => {
  let column = 0
  while (true) {
    let isColumnSuitable = true
    for (let i = 0; i < spanDays; i++) {
      const dayIndex = startDayIndex + i
      if (!recordsInDay[dayIndex]) {
        recordsInDay[dayIndex] = {}
      }
      if (recordsInDay[dayIndex][column]) {
        isColumnSuitable = false
        break
      }
    }

    if (isColumnSuitable) {
      return column
    }
    column++
  }
}

const calendarData = computed(() => {
  if (!formattedData.value || !calendarRange.value) return []
  const recordsInDay: {
    [key: number]: {
      [key: number]: boolean
    }
  } = {
    0: {},
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
    6: {},
  }

  const recordsInRange: Array<Row> = []
  const perDayWidth = containerWidth.value / 7

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col
    if (fromCol && toCol) {
      for (const record of [...formattedData.value].filter((r) => {
        const startDate = dayjs(r.row[fromCol.title!])
        const endDate = dayjs(r.row[toCol.title!])
        if (!startDate.isValid() || !endDate.isValid()) return false
        return !endDate.isBefore(startDate)
      })) {
        const id = record.row.id ?? generateRandomNumber()
        let startDate = dayjs(record.row[fromCol.title!])
        const ogStartDate = startDate.clone()
        const endDate = dayjs(record.row[toCol.title!])

        if (startDate.isBefore(selectedDateRange.value.start)) {
          startDate = dayjs(selectedDateRange.value.start)
        }

        const startDaysDiff = startDate.diff(selectedDateRange.value.start, 'day')

        let spanDays = Math.max(Math.min(endDate.diff(startDate, 'day'), 6) + 1, 1)

        if (endDate.isAfter(startDate, 'month')) {
          spanDays = 7 - startDaysDiff
        }

        if (startDaysDiff > 0) {
          spanDays = Math.min(spanDays, 7 - startDaysDiff)
        }
        const widthStyle = `calc(max(${spanDays} * ${perDayWidth}px, ${perDayWidth}px))`

        let suitableColumn = -1
        for (let i = 0; i < spanDays; i++) {
          const dayIndex = startDaysDiff + i

          if (!recordsInDay[dayIndex]) {
            recordsInDay[dayIndex] = {}
          }

          if (suitableColumn === -1) {
            suitableColumn = findFirstSuitableColumn(recordsInDay, dayIndex, spanDays)
          }
        }

        // Mark the suitable column as occupied for the entire span
        for (let i = 0; i < spanDays; i++) {
          const dayIndex = startDaysDiff + i
          recordsInDay[dayIndex][suitableColumn] = true
        }

        let position = 'none'

        const isStartInRange =
          ogStartDate && ogStartDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')
        const isEndInRange = endDate && endDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')

        if (isStartInRange && isEndInRange) {
          position = 'rounded'
        } else if (
          startDate &&
          endDate &&
          startDate.isBefore(selectedDateRange.value.start) &&
          endDate.isAfter(selectedDateRange.value.end)
        ) {
          position = 'none'
        } else if (
          startDate &&
          endDate &&
          (startDate.isAfter(selectedDateRange.value.end) || endDate.isBefore(selectedDateRange.value.start))
        ) {
          position = 'none'
        } else if (isStartInRange) {
          position = 'leftRounded'
        } else if (isEndInRange) {
          position = 'rightRounded'
        }

        recordsInRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            position,
            id,
            style: {
              width: widthStyle,
              left: `${startDaysDiff * perDayWidth}px`,
              top: `${suitableColumn * 40}px`,
            },
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        const id = record.row.id ?? generateRandomNumber()

        const startDate = dayjs(record.row[fromCol.title!])
        const startDaysDiff = Math.max(startDate.diff(selectedDateRange.value.start, 'day'), 0)
        const suitableColumn = findFirstSuitableColumn(recordsInDay, startDaysDiff, 1)
        recordsInDay[startDaysDiff][suitableColumn] = true

        recordsInRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            id,
            position: 'rounded',
            style: {
              width: `calc(${perDayWidth}px)`,
              left: `${startDaysDiff * perDayWidth}px`,
              top: `${suitableColumn * 40}px`,
            },
          },
        })
      }
    }
  })

  return recordsInRange
})

const dragElement = ref<HTMLElement | null>(null)

const draggingId = ref<string | null>(null)

const resizeInProgress = ref(false)

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const isDragging = ref(false)
const dragRecord = ref<Row>()

const resizeDirection = ref<'right' | 'left' | null>()
const resizeRecord = ref<Row | null>(null)

const hoverRecord = ref<string | null>()

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !resizeRecord.value) return
  const { width, left } = container.value.getBoundingClientRect()

  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col
  if (!fromCol || !toCol) return

  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title!])
  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title!])

  const day = Math.min(Math.floor(percentX * 7), 6)

  if (resizeDirection.value === 'right') {
    let newEndDate = dayjs(selectedDateRange.value.start).add(day, 'day')
    const updateProperty = [toCol.title!]

    if (dayjs(newEndDate).isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone()
    }

    if (!newEndDate.isValid()) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format('YYYY-MM-DD'),
      },
    }

    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)

      if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
        return newRow
      }
      return r
    })
    useDebouncedRowUpdate(newRow, updateProperty, false)
  } else if (resizeDirection.value === 'left') {
    let newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
    const updateProperty = [fromCol.title!]

    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone()
    }
    if (!newStartDate) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD'),
      },
    }

    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)

      if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
        return newRow
      }
      return r
    })
    useDebouncedRowUpdate(newRow, updateProperty, false)
  }
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

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !dragRecord.value) return
  const { width, left } = container.value.getBoundingClientRect()

  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return

  const day = Math.min(Math.floor(percentX * 7), 6)

  const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
  if (!newStartDate) return

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD'),
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

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD')
  }

  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)

    if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
      return newRow
    }
    return r
  })
}

const stopDrag = (event: MouseEvent) => {
  event.preventDefault()
  clearTimeout(dragTimeout.value!)

  if (!isUIAllowed('dataEdit')) return
  if (!isDragging.value || !container.value || !dragRecord.value) return

  const { width, left } = container.value.getBoundingClientRect()

  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  const day = Math.floor(percentX * 7)

  const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
  if (!newStartDate || !fromCol) return

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD'),
    },
  }

  const updateProperty = [fromCol.title!]

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

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD')

    updateProperty.push(toCol.title!)
  }

  if (!newRow) return

  if (dragElement.value) {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)

      if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
        return newRow
      }
      return r
    })
  } else {
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)

      return pk !== extractPkFromRow(newRow.row, meta.value!.columns!)
    })
  }

  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value.classList.remove('hide')
    // isDragging.value = false
    draggingId.value = null
    dragElement.value = null
  }

  updateRowProperty(newRow, updateProperty, false)

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
    draggingId.value = record.rowMeta.id!
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
  if (!isUIAllowed('dataEdit')) return
  event.preventDefault()

  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
    }: {
      record: Row
    } = JSON.parse(data)
    const { width, left } = container.value.getBoundingClientRect()

    const percentX = (event.clientX - left - window.scrollX) / width

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) return

    const day = Math.floor(percentX * 7)

    const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD'),
      },
    }

    const updateProperty = [fromCol.title!]

    if (toCol) {
      const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
      const toDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

      if (fromDate && toDate) {
        endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }
      newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD')
      updateProperty.push(toCol.title!)
    }

    if (!newRow) return

    if (dragElement.value) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
          return newRow
        }
        return r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        return pk !== extractPkFromRow(newRow.row, meta.value!.columns!)
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
</script>

<template>
  <div class="flex relative flex-col prevent-select" data-testid="nc-calendar-week-view" @drop="dropEvent">
    <div class="flex">
      <div
        v-for="(date, weekIndex) in weekDates"
        :key="weekIndex"
        :class="{
          '!border-brand-500 !border-b-gray-200': dayjs(date).isSame(selectedDate, 'day'),
        }"
        class="w-1/7 text-center text-sm text-gray-500 w-full py-1 border-gray-200 border-l-gray-50 border-t-gray-50 last:border-r-0 border-1 bg-gray-50"
      >
        {{ dayjs(date).format('DD ddd') }}
      </div>
    </div>
    <div ref="container" class="flex h-[calc(100vh-11.6rem)]">
      <div
        v-for="(date, dateIndex) in weekDates"
        :key="dateIndex"
        :class="{
          '!border-1 !border-t-0 border-brand-500': dayjs(date).isSame(selectedDate, 'day'),
        }"
        class="flex flex-col border-r-1 min-h-[100vh] last:border-r-0 items-center w-1/7"
        @click="selectedDate = date"
      ></div>
    </div>
    <div
      class="absolute nc-scrollbar-md overflow-y-auto mt-9 pointer-events-none inset-0"
      data-testid="nc-calendar-week-record-container"
    >
      <div
        v-for="(record, id) in calendarData"
        :key="id"
        :data-testid="`nc-calendar-week-record-${record.row[displayField!.title!]}`"
        :data-unique-id="record.rowMeta.id"
        :style="{
          ...record.rowMeta.style,
          boxShadow:
            record.rowMeta.id === draggingId
              ? '0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.10)'
              : 'none',
        }"
        class="absolute group draggable-record pointer-events-auto"
        @mousedown="dragStart($event, record)"
        @mouseleave="hoverRecord = null"
        @mouseover="hoverRecord = record.rowMeta.id"
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :hover="hoverRecord === record.rowMeta.id"
            :position="record.rowMeta.position"
            :record="record"
            :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
            color="blue"
            @dblclick="emits('expand-record', record)"
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
          </LazySmartsheetCalendarRecordCard>
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
.prevent-select {
  -webkit-user-select: none; /* Safari */
  -ms-user-select: none; /* IE 10 and IE 11 */
  user-select: none; /* Standard syntax */
}
</style>

<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Row } from '~/lib'
import { computed, ref } from '#imports'

const emits = defineEmits(['expand-record'])

const { selectedDateRange, formattedData, formattedSideBarData, calendarRange, displayField, selectedTime, updateRowProperty } =
  useCalendarViewStoreOrThrow()

const container = ref<null | HTMLElement>(null)

const { width: containerWidth } = useElementSize(container)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const datesHours = computed(() => {
  const datesHours: Array<Array<dayjs.Dayjs>> = []
  const startOfWeek = new Date(selectedDateRange.value.start!)
  const endOfWeek = new Date(selectedDateRange.value.end!)

  while (startOfWeek.getTime() <= endOfWeek.getTime()) {
    const hours: Array<dayjs.Dayjs> = []
    for (let i = 0; i < 24; i++) {
      hours.push(
        dayjs()
          .hour(i)
          .minute(0)
          .second(0)
          .millisecond(0)
          .year(startOfWeek.getFullYear() || dayjs().year())
          .month(startOfWeek.getMonth() || dayjs().month())
          .date(startOfWeek.getDate() || dayjs().date()),
      )
    }
    datesHours.push(hours)
    startOfWeek.setDate(startOfWeek.getDate() + 1)
  }
  return datesHours
})

function getRandomNumbers() {
  const typedArray = new Uint8Array(10)
  const randomValues = window.crypto.getRandomValues(typedArray)
  return randomValues.join('')
}

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

const recordsAcrossAllRange = computed<{
  records: Array<Row>
  count: {
    [key: string]: {
      [key: string]: {
        overflow: boolean
        count: number
        overflowCount: number
      }
    }
  }
}>(() => {
  if (!formattedData.value || !calendarRange.value || !container.value) return []

  const { scrollHeight } = container.value

  const perWidth = containerWidth.value / 7
  const perHeight = scrollHeight / 24

  const scheduleStart = dayjs(selectedDateRange.value.start).startOf('day')
  const scheduleEnd = dayjs(selectedDateRange.value.end).endOf('day')

  const perRecordHeight = 40

  const spaceBetweenRecords = 5

  const recordsInDayHour: {
    [key: string]: {
      [key: string]: {
        overflow: boolean
        count: number
        overflowCount: number
      }
    }
  } = {}

  if (!calendarRange.value) return []

  const recordsToDisplay: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col

    const sortedFormattedData = [...formattedData.value].filter((record) => {
      const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null

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
        const startDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        if (!startDate) return
        const dateKey = startDate?.format('YYYY-MM-DD')
        const hourKey = startDate?.format('HH:mm')

        if (dateKey && hourKey) {
          if (!recordsInDayHour[dateKey]) {
            recordsInDayHour[dateKey] = {}
          }
          if (!recordsInDayHour[dateKey][hourKey]) {
            recordsInDayHour[dateKey][hourKey] = {
              overflow: false,
              count: 0,
              overflowCount: 0,
            }
          }
          recordsInDayHour[dateKey][hourKey].count++
        }

        const id = record.rowMeta.id ?? getRandomNumbers()

        const dayIndex = dayjs(dateKey).day() - 1
        const hourIndex = datesHours.value[dayIndex].findIndex((h) => h.format('HH:mm') === hourKey)

        const style: Partial<CSSStyleDeclaration> = {
          left: `${dayIndex * perWidth}px`,
          top: `${hourIndex * perHeight}px`,
        }

        const recordIndex = recordsInDayHour[dateKey][hourKey].count

        const top = hourIndex * perHeight + (recordIndex - 1) * (perRecordHeight + spaceBetweenRecords)

        const heightRequired = perRecordHeight * recordIndex + spaceBetweenRecords

        if (heightRequired + 20 > perHeight) {
          style.display = 'none'
          recordsInDayHour[dateKey][hourKey].overflow = true
          recordsInDayHour[dateKey][hourKey].overflowCount++
        } else {
          style.height = `${perRecordHeight}px`
          style.top = `${top}px`
        }
        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            id,
            style,
            range,
          },
        })
      } else if (fromCol && toCol) {
        const id = record.rowMeta.id ?? getRandomNumbers()

        let startDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
        let endDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

        if (!startDate?.isValid() || !endDate?.isValid()) return

        if (startDate.isBefore(scheduleStart, 'minutes')) {
          startDate = scheduleStart
        }
        if (endDate.isAfter(scheduleEnd, 'minutes')) {
          endDate = scheduleEnd
        }

        let currentStartDate: dayjs.Dayjs = startDate.clone()

        while (currentStartDate.isSameOrBefore(endDate!, 'day')) {
          const currentEndDate = currentStartDate.clone().endOf('day')
          const recordStart: dayjs.Dayjs = currentEndDate.isSame(startDate, 'day') ? startDate : currentStartDate
          const recordEnd = currentEndDate.isSame(endDate, 'day') ? endDate : currentEndDate

          const dateKey = recordStart.format('YYYY-MM-DD')

          let hour = recordStart?.clone().startOf('hour')

          while (hour.isSameOrBefore(recordEnd, 'hour')) {
            const hourKey = hour.format('HH:mm')

            if (!recordsInDayHour[dateKey]) {
              recordsInDayHour[dateKey] = {}
            }
            if (!recordsInDayHour[dateKey][hourKey]) {
              recordsInDayHour[dateKey][hourKey] = {
                overflow: false,
                count: 0,
                overflowCount: 0,
              }
            }
            recordsInDayHour[dateKey][hourKey].count++
            hour = hour.add(1, 'hour')
          }

          let dayIndex = recordStart.day()

          if (dayIndex === -1) {
            dayIndex = 7
          }

          let maxRecordCount = 0

          for (let i = 0; i < (datesHours.value[dayIndex - 1] ?? []).length; i++) {
            const hourKey = datesHours.value[dayIndex - 1][i].format('HH:mm')
            if (recordsInDayHour[dateKey]?.[hourKey]?.count > maxRecordCount) {
              maxRecordCount = recordsInDayHour[dateKey][hourKey].count
            }
          }

          const startHourIndex = Math.max(
            (datesHours.value[dayIndex - 1] ?? []).findIndex((h) => h.format('HH:mm') === recordStart.format('HH:mm')),
            0,
          )

          const endHourIndex = Math.max(
            (datesHours.value[dayIndex - 1] ?? []).findIndex(
              (h) => h.format('HH:mm') === recordEnd?.startOf('hour').format('HH:mm'),
            ),
            0,
          )

          console.log(
            record.row[displayField.value.title],
            recordEnd?.startOf('hour').format('HH:mm'),
            (datesHours.value[dayIndex - 1] ?? []).findIndex(
              (h) => h.format('HH:mm') === recordEnd?.startOf('hour').format('HH:mm'),
            ),
          )

          const spanHours = endHourIndex - startHourIndex + 1

          const left = (dayIndex - 1) * perWidth

          const top = startHourIndex * perRecordHeight

          const height = (endHourIndex - startHourIndex + 1) * perHeight - spanHours - 5

          const style: Partial<CSSStyleDeclaration> = {
            left: `${left}px`,
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
            },
          })

          currentStartDate = currentStartDate.add(1, 'day').hour(0).minute(0)
        }
      }
    })

    console.log(recordsInDayHour)
  })

  return {
    records: recordsToDisplay,
    count: recordsInDayHour,
  }
})

const dragElement = ref<HTMLElement | null>(null)

const draggingId = ref<string | null>(null)

const resizeInProgress = ref(false)

const dragTimeout = ref<string | number | null | NodeJS.Timeout>(null)

const isDragging = ref(false)
const dragRecord = ref<Row>()

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !dragRecord.value) return
  const { width, left } = container.value.getBoundingClientRect()

  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return

  const day = Math.floor(percentX * 7)

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
      emits('expand-record', record)
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
  <div class="w-full relative prevent-select" @drop="dropEvent">
    <div class="flex absolute w-full top-0">
      <div
        v-for="date in datesHours"
        :key="date[0].toISOString()"
        class="w-1/7 text-center text-sm text-gray-500 w-full py-1 border-gray-200 border-b-1 border-r-1 bg-gray-50"
      >
        {{ dayjs(date[0]).format('DD ddd') }}
      </div>
    </div>
    <div ref="container" class="h-[calc(100vh-11.7rem)] relative flex w-full mt-7.5 overflow-y-auto nc-scrollbar-md">
      <div v-for="(date, index) in datesHours" :key="index" class="h-full w-1/7">
        <div
          v-for="(hour, hourIndex) in date"
          :key="hourIndex"
          :class="{
            'border-2 !border-brand-500': hour.isSame(selectedTime, 'hour'),
          }"
          class="text-center relative h-56 text-sm text-gray-500 w-full py-1 border-gray-200 border-1 border-r-white border-t-white last:border-r-white bg-gray-50"
          @click="selectedTime = hour.toDate()"
        >
          <span v-if="date[0].day() === selectedDateRange.start?.getDay()" class="absolute left-1">
            {{ hour.format('h A') }}
          </span>
          <div
            v-if="recordsAcrossAllRange.count?.[dayjs(hour).format('YYYY-MM-DD')]?.[dayjs(hour).format('HH:mm')]?.overflow"
            class="text-xs absolute bottom-2 text-center inset-x-0 !z-[90] text-gray-500"
          >
            +
            {{ recordsAcrossAllRange.count[dayjs(hour).format('YYYY-MM-DD')]?.[dayjs(hour).format('HH:mm')]?.overflowCount }}
            more
          </div>
        </div>
      </div>

      <div class="absolute pointer-events-none inset-0 !mt-[20px]">
        <div
          v-for="(record, rowIndex) in recordsAcrossAllRange.records"
          :key="rowIndex"
          :data-unique-id="record.rowMeta!.id"
          :style="record.rowMeta!.style"
          class="absolute draggable-record w-1/7 cursor-pointer pointer-events-auto"
          @mousedown="dragStart($event, record)"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :date="dayjs(record.row![record.rowMeta!.range!.fk_from_col.title!]).format('HH:mm')"
              :name="record.row![displayField!.title!]"
              :position="record.rowMeta!.position"
              :record="record"
              :resize="false"
              color="blue"
              size="auto"
            />
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

<script lang="ts" setup>
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

const emit = defineEmits(['expandRecord', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const container = ref()

const { isUIAllowed } = useRoles()

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { selectedDate, selectedTime, formattedData, calendarRange, formattedSideBarData, updateRowProperty } =
  useCalendarViewStoreOrThrow()

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []
  for (let i = 0; i < 24; i++) {
    hours.push(
      dayjs()
        .hour(i)
        .minute(0)
        .second(0)
        .millisecond(0)
        .year(selectedDate.value.getFullYear() || dayjs().year())
        .month(selectedDate.value.getMonth() || dayjs().month())
        .date(selectedDate.value.getDate() || dayjs().date()),
    )
  }
  return hours
})

function getRandomNumbers() {
  const typedArray = new Uint8Array(10)
  const randomValues = window.crypto.getRandomValues(typedArray)
  return randomValues.join('')
}

const recordsAcrossAllRange = computed<Row[]>(() => {
  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  const overlaps: {
    [key: string]: string[]
  } = {}

  const perRecordHeight = 80

  if (!calendarRange.value) return []

  let recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col

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

    if (fromCol && endCol) {
      for (const record of sortedFormattedData) {
        const id = getRandomNumbers()
        let startDate = dayjs(record.row[fromCol.title!])
        let endDate = dayjs(record.row[endCol.title!])

        if (!startDate.isValid() || startDate.isAfter(endDate)) continue

        if (!endDate.isValid()) {
          endDate = startDate.clone().add(30, 'minutes')
        }

        if (startDate.isBefore(scheduleStart, 'minutes')) {
          startDate = scheduleStart
        }

        if (endDate.isAfter(scheduleEnd, 'minutes')) {
          endDate = scheduleEnd
        }

        const topInPixels = (startDate.hour() + startDate.minute() / 60) * 80
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const startHour = startDate.hour()
        const endHour = endDate.hour()

        let startMinutes = startDate.minute() + startHour * 60

        const endMinutes = endDate.minute() + endHour * 60

        while (startMinutes < endMinutes) {
          if (!overlaps[startMinutes]) {
            overlaps[startMinutes] = []
          }
          overlaps[startMinutes].push(id)
          startMinutes += 15
        }
        const finalTopInPixels = topInPixels + 5 + startHour * 2

        const style: Partial<CSSStyleDeclaration> = {
          top: `${finalTopInPixels}px`,
          height: `${heightInPixels}px`,
        }

        let position = 'none'
        const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(selectedDate.value, 'day')

        if (isSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rounded'
        } else if (isBeforeSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'none'
        } else if (isSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'leftRounded'
        } else if (isBeforeSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rightRounded'
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
        const id = getRandomNumbers()

        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[fromCol.title!]).add(30, 'minutes')

        const startHour = startDate.hour()
        const endHour = endDate.hour()

        let startMinutes = startDate.minute() + startHour * 60
        const endMinutes = endDate.minute() + endHour * 60

        while (startMinutes < endMinutes) {
          if (!overlaps[startMinutes]) {
            overlaps[startMinutes] = []
          }
          overlaps[startMinutes].push(id)
          startMinutes += 10
        }

        const topInPixels = (startDate.hour() + startDate.minute() / 60) * 80
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const finalTopInPixels = topInPixels + startHour

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style: {
              top: `${finalTopInPixels}px`,
              height: `${heightInPixels + 5}px`,
            },
            id,
            position: 'rounded',
          },
        })
      }
    }
  })

  recordsByRange = recordsByRange.map((record) => {
    let maxOverlaps = 1
    let overlapIndex = 0
    for (const minutes in overlaps) {
      if (overlaps[minutes].includes(record.rowMeta.id!)) {
        maxOverlaps = Math.max(maxOverlaps, overlaps[minutes].length)

        overlapIndex = Math.max(overlaps[minutes].indexOf(record.rowMeta.id!), overlapIndex)
      }
    }

    const spacing = 1
    const widthPerRecord = (100 - spacing * (maxOverlaps - 1)) / maxOverlaps
    const leftPerRecord = (widthPerRecord + spacing) * overlapIndex

    record.rowMeta.style = {
      ...record.rowMeta.style,
      left: `${leftPerRecord}%`,
      width: `calc(${widthPerRecord}%)`,
    }
    return record
  })

  return recordsByRange
})

const dragRecord = ref<Row | null>(null)
const isDragging = ref(false)
const draggingId = ref<string | null>(null)
const dragElement = ref<HTMLElement | null>(null)

const resizeDirection = ref<'right' | 'left' | null>()
const resizeInProgress = ref(false)
const resizeRecord = ref<Row | null>()

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !resizeRecord.value) return
  const { top, bottom } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

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

  const hour = Math.floor(percentY * 24)

  if (resizeDirection.value === 'right') {
    let newEndDate = dayjs(selectedDate.value).add(hour, 'hour')
    const updateProperty = [toCol.title!]

    if (dayjs(newEndDate).isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone()
    }

    if (!newEndDate.isValid()) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format('YYYY-MM-DD HH:mm:ssZ'),
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
    let newStartDate = dayjs(selectedDate.value).add(hour, 'hour')
    const updateProperty = [fromCol.title!]

    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone()
    }
    if (!newStartDate) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
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
const onResizeStart = (direction: 'right' | 'left', _event: MouseEvent, record: Row) => {
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

  const { top, bottom } = container.value.getBoundingClientRect()

  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  const { scrollHeight } = container.value

  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return

  const hour = Math.floor(percentY * 24)

  const newStartDate = dayjs(selectedDate.value).add(hour, 'hour')

  if (!newStartDate) return

  let endDate

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
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'hour'), 'hour')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('hour')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('hour')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')
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

  const { top } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  const hour = Math.floor(percentY * 24)

  const newStartDate = dayjs(selectedDate.value).add(hour, 'hour')
  if (!newStartDate || !fromCol) return

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

    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'hour'), 'hour')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('hour')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('hour')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')

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
    //  isDragging.value = false
    draggingId.value = null
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
      emit('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.length"
    ref="container"
    class="w-full relative no-selection h-[calc(100vh-10rem)] overflow-y-auto nc-scrollbar-md"
  >
    <div
      v-for="(hour, index) in hours"
      :key="index"
      :class="{
        '!border-brand-500': hour.isSame(selectedTime),
      }"
      class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
      @click="selectedTime = hour.toDate()"
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
    </div>
    <div class="absolute inset-0 pointer-events-none">
      <div class="relative !ml-[60px]">
        <div
          v-for="(record, rowIndex) in recordsAcrossAllRange"
          :key="rowIndex"
          :data-unique-id="record.rowMeta.id"
          :style="record.rowMeta.style"
          class="absolute draggable-record group cursor-pointer pointer-events-auto"
          @mousedown="dragStart($event, record)"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarVRecordCard
              :date="dayjs(record.row![record.rowMeta!.range!.fk_from_col.title!]).format('HH:mm')"
              :name="record.row![displayField!.title!]"
              :position="record.rowMeta!.position"
              :record="record"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              color="blue"
              size="auto"
              @resize-start="onResizeStart"
            />
          </LazySmartsheetRow>
        </div>
      </div>
    </div>
  </div>

  <div v-else ref="container" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
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

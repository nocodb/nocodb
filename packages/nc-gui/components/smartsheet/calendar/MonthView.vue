<script lang="ts" setup>
import dayjs from 'dayjs'

import { UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row } from '#imports'
import { generateRandomNumber, isRowEmpty } from '~/utils'

const emit = defineEmits(['new-record', 'expandRecord'])

const {
  selectedDate,
  selectedMonth,
  formattedData,
  formattedSideBarData,
  sideBarFilterOption,
  displayField,
  calendarRange,
  showSideMenu,
  updateRowProperty,
} = useCalendarViewStoreOrThrow()

const isMondayFirst = ref(true)

const { isUIAllowed } = useRoles()

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

    const sortedFormattedData = [...formattedData.value].filter((record) => {
      const fromDate = record.row[startCol!.title!] ? dayjs(record.row[startCol!.title!]) : null

      if (startCol && endCol) {
        const fromDate = record.row[startCol!.title!] ? dayjs(record.row[startCol!.title!]) : null
        const toDate = record.row[endCol!.title!] ? dayjs(record.row[endCol!.title!]) : null
        return fromDate && toDate && !toDate.isBefore(fromDate)
      } else if (startCol && !endCol) {
        return !!fromDate
      }
      return false
    })

    sortedFormattedData.forEach((record: Row) => {
      if (!endCol && startCol) {
        const startDate = dayjs(record.row[startCol!.title!])
        const dateKey = startDate.format('YYYY-MM-DD')

        if (!recordsInDay[dateKey]) {
          recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0 }
        }
        recordsInDay[dateKey].count++
        const id = record.rowMeta.id ?? generateRandomNumber()

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
        const heightRequired = perRecordHeight * recordIndex + spaceBetweenRecords + 25

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
        const startDate = dayjs(record.row[startCol!.title!])
        const endDate = dayjs(record.row[endCol!.title!])
        let currentWeekStart = startDate.startOf('week')

        const id = record.rowMeta.id ?? generateRandomNumber()
        while (
          currentWeekStart.isSameOrBefore(endDate, 'day') &&
          currentWeekStart.isBefore(dates.value[dates.value.length - 1][6])
        ) {
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

          if (heightRequired + 15 > perHeight) {
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

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !dragRecord.value) return
  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height
  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  const week = Math.floor(percentY * dates.value.length)
  const day = Math.floor(percentX * 7)

  focusedDate.value = dates.value[week] ? dates.value[week][day] : null
  selectedDate.value = null

  const newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null

  if (!newStartDate) return

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value!.row,
      [fromCol!.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }

  if (toCol) {
    const fromDate = dragRecord.value!.row[fromCol!.title!] ? dayjs(dragRecord!.value!.row[fromCol!.title!]) : null
    const toDate = dragRecord.value!.row[toCol!.title!] ? dayjs(dragRecord.value!.row[toCol!.title!]) : null

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
  }

  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)

    if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
      return newRow
    }
    return r
  })
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
  const day = Math.floor(percentX * 7)

  if (resizeDirection.value === 'right') {
    let newEndDate = dates.value[week] ? dayjs(dates.value[week][day]).endOf('day') : null

    const updateProperty = [toCol!.title!]

    if (dayjs(newEndDate).isBefore(ogStartDate)) {
      newEndDate = dayjs(ogStartDate).clone().endOf('day')
    }

    if (!newEndDate) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol!.title!]: dayjs(newEndDate).format('YYYY-MM-DD HH:mm:ssZ'),
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
    let newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null
    const updateProperty = [fromCol!.title!]

    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(ogEndDate).clone()
    }
    if (!newStartDate) return

    const newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol!.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
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
  resizeDirection.value = undefined
  resizeRecord.value = undefined
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit') || draggingId.value) return

  selectedDate.value = null
  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const stopDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !dragRecord.value || !isDragging.value) return

  event.preventDefault()
  clearTimeout(dragTimeout.value)

  dragElement.value!.style.boxShadow = 'none'

  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height
  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  const week = Math.floor(percentY * dates.value.length)
  const day = Math.floor(percentX * 7)

  const newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null
  if (!newStartDate) return

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol!.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }

  const updateProperty = [fromCol!.title!]

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol!.title!] ? dayjs(dragRecord.value.row[fromCol!.title!]) : null
    const toDate = dragRecord.value.row[toCol!.title!] ? dayjs(dragRecord.value.row[toCol!.title!]) : null

    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    dragRecord.value = undefined
    newRow.row[toCol!.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')

    updateProperty.push(toCol!.title!)
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
    isDragging.value = false
    draggingId.value = null
    dragElement.value = null
  }

  updateRowProperty(newRow, updateProperty, false)
  focusedDate.value = null

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit') || resizeInProgress.value || !record.rowMeta.id) return
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
    selectedDate.value = null

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
    }: {
      record: Row
    } = JSON.parse(data)
    const { width, left, top, height } = calendarGridContainer.value.getBoundingClientRect()

    const percentY = (event.clientY - top - window.scrollY) / height
    const percentX = (event.clientX - left - window.scrollX) / width

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) return

    const week = Math.floor(percentY * dates.value.length)
    const day = Math.floor(percentX * 7)

    const newStartDate = dates.value[week] ? dayjs(dates.value[week][day]) : null
    if (!newStartDate) return

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
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

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value.classList.remove('hide')

      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
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
</script>

<template>
  <div v-if="calendarRange" class="h-full prevent-select relative">
    <div class="grid grid-cols-7">
      <div
        v-for="(day, index) in days"
        :key="index"
        class="text-center bg-gray-50 py-1 text-sm border-b-1 border-r-1 last:border-r-0 border-gray-200 font-semibold text-gray-500"
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
    >
      <div v-for="(week, weekIndex) in dates" :key="weekIndex" class="grid grid-cols-7 grow">
        <div
          v-for="(day, dateIndex) in week"
          :key="`${weekIndex}-${dateIndex}`"
          :class="{
            'border-brand-500 border-1 border-r-1 border-b-1':
              isDateSelected(day) || (focusedDate && dayjs(day).isSame(focusedDate, 'day')),
            '!text-gray-400': !isDayInPagedMonth(day),
          }"
          class="text-right relative group text-sm h-full border-r-1 border-b-1 border-gray-200 font-medium hover:bg-gray-50 text-gray-800 bg-white"
          @click="selectDate(day)"
        >
          <div v-if="isUIAllowed('dataEdit')" class="flex justify-between p-1">
            <span
              :class="{
                block: !isDateSelected(day),
                hidden: isDateSelected(day),
              }"
              class="group-hover:hidden"
            ></span>

            <NcDropdown v-if="calendarRange.length > 1" auto-close>
              <NcButton
                :class="{
                  '!block': isDateSelected(day),
                  '!hidden': !isDateSelected(day),
                }"
                class="!group-hover:block"
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
                        emit('new-record', record)
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
              :class="{
                '!block': isDateSelected(day),
                '!hidden': !isDateSelected(day),
              }"
              class="!group-hover:block"
              size="small"
              type="secondary"
              @click="
                () => {
                  const record = {
                    row: {
                      [calendarRange[0].fk_from_col!.title!]: (day).format('YYYY-MM-DD HH:mm:ssZ'),
                    },
                  }
                  emit('new-record', record)
                }
              "
            >
              <component :is="iconMap.plus" class="h-4 w-4" />
            </NcButton>
            <span
              :class="{
                'bg-brand-50 text-brand-500': day.isSame(dayjs(), 'date'),
              }"
              class="px-1.5 rounded-lg py-1 my-1"
            >
              {{ day.format('DD') }}
            </span>
          </div>
          <div v-if="!isUIAllowed('dataEdit')" class="p-3">{{ dayjs(day).format('DD') }}</div>

          <NcButton
            v-if="
              recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')] &&
              recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflow &&
              !draggingId
            "
            class="!absolute bottom-1 text-center w-15 mx-auto inset-x-0 z-3 text-gray-500"
            size="xxsmall"
            type="secondary"
            @click="viewMore(day)"
          >
            <span class="text-xs"> + {{ recordsToDisplay.count[dayjs(day).format('YYYY-MM-DD')]?.overflowCount }} more </span>
          </NcButton>
        </div>
      </div>
    </div>
    <div class="absolute inset-0 pointer-events-none mt-8 pb-7.5">
      <div
        v-for="(record, recordIndex) in recordsToDisplay.records"
        :key="recordIndex"
        :data-unique-id="record.rowMeta.id"
        :style="{
          ...record.rowMeta.style,
          zIndex: record.rowMeta.id === draggingId ? 100 : 0,
          boxShadow:
            record.rowMeta.id === draggingId
              ? '0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.10)'
              : 'none',
        }"
        class="absolute group draggable-record cursor-pointer pointer-events-auto"
        @mouseleave="hoverRecord = null"
        @mouseover="hoverRecord = record.rowMeta.id"
        @mousedown.stop="dragStart($event, record)"
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :hover="hoverRecord === record.rowMeta.id"
            :position="record.rowMeta.position"
            :record="record"
            :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
            :selected="
              dragRecord
                ? dragRecord.rowMeta.id === record.rowMeta.id
                : resizeRecord
                ? resizeRecord.rowMeta.id === record.rowMeta.id
                : false
            "
            @resize-start="onResizeStart"
            @dblclick.stop="emit('expand-record', record)"
          >
            <template v-if="!isRowEmpty(record, displayField)">
              <div
                :class="{
                  'mt-1.4': displayField!.uidt === UITypes.SingleLineText,
                  'mt-1': displayField!.uidt === UITypes.MultiSelect || displayField!.uidt === UITypes.SingleSelect,
                }"
              >
                <LazySmartsheetVirtualCell
                  v-if="isVirtualCol(displayField!)"
                  v-model="record.row[displayField!.title!]"
                  :column="displayField"
                  :row="record"
                />

                <LazySmartsheetCell
                  v-else
                  v-model="record.row[displayField!.title!]"
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

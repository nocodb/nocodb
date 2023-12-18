<script lang="ts" setup>

import {
  ActiveViewInj,
  CalendarViewTypeInj,
  inject,
  IsCalendarInj,
  IsFormInj,
  IsGalleryInj,
  IsGridInj,
  IsKanbanInj,
  MetaInj,
  provide,
  ref,
  useI18n,
} from '#imports'
import dayjs from "dayjs";

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const {t} = useI18n()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

const {
  formattedData,
  loadCalendarMeta,
  updateCalendarMeta,
  calendarMetaData,
  selectedDate,
  selectedDateRange,
  activeCalendarView,
  addEmptyRow,
  paginationData,
  paginateCalendarView
} = useCalendarViewStoreOrThrow()


provide(CalendarViewTypeInj, activeCalendarView)

const showSideMenu = ref(true)

const isExpanded = ref(false)

const expandedRecordId = ref<string | null>(null);

const expandRecord = (id: string) => {
  isExpanded.value = true
  expandedRecordId.value = id
}

const headerText = computed(() => {
  switch (activeCalendarView.value) {
    case 'day':
      return dayjs(selectedDate.value).format('D MMMM YYYY')
    case 'week':
      return dayjs(selectedDateRange.value.start).format('D MMMM YYYY') + ' - ' + dayjs(selectedDateRange.value.end).format('D MMMM YYYY')
    case 'month':
      return dayjs(selectedDate.value).format('MMMM YYYY')
    case 'year':
      return dayjs(selectedDate.value).format('YYYY')
  }
})


</script>


<template>
  <div class="flex h-full flex-row">
    <div class="flex flex-col w-full">
      <div class="flex justify-between p-3 items-center border-b-1 border-gray-200">
        <div class="flex justify-start gap-3 items-center">
          <NcButton size="small" type="secondary" @click="paginateCalendarView('prev')">
            <component :is="iconMap.doubleLeftArrow" class="h-4 w-4"/>
          </NcButton>
          <span class="font-bold text-gray-700">{{headerText}}</span>
          <NcButton size="small" type="secondary" @click="paginateCalendarView('next')" >
            <component :is="iconMap.doubleRightArrow" class="h-4 w-4"/>
          </NcButton>
        </div>
        <NcButton v-if="!isMobileMode" size="small" type="secondary" @click="showSideMenu = !showSideMenu">
          <component :is="iconMap.sidebarMinimise" :class="{
            'transform rotate-180': showSideMenu,
          }" class="h-4 w-4 transition-all"/>
        </NcButton>
      </div>
      <LazySmartsheetCalendarYearView v-if="activeCalendarView === 'year'" class="flex-grow-1" />
      <LazySmartsheetCalendarMonthView v-else-if="activeCalendarView === 'month'" class="flex-grow-1" />

    </div>
    <LazySmartsheetCalendarSideMenu v-if="!isMobileMode" :visible="showSideMenu" @expand-record="expandRecord"/>
  </div>

  <LazySmartsheetExpandedForm v-model="isExpanded" :view="view" :row="{
    row: {},
    rowMeta: {
      new: !expandedRecordId,
    },

  }" :meta="meta" />


</template>
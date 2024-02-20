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

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { isMobileMode } = useGlobal()

const {t} = useI18n()

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(false))

provide(IsKanbanInj, ref(false))

provide(IsCalendarInj, ref(true))

provide(CalendarViewTypeInj, ref('year' as const))

const showSideMenu = ref(true)

const isExpanded = ref(false)

const expandedRecordId = ref<string | null>(null);

const expandRecord = (id: string) => {
  isExpanded.value = true
  expandedRecordId.value = id
}

</script>


<template>
  <div class="flex h-full flex-row">
    <div class="flex flex-col w-full">
      <div class="flex justify-between p-3 items-center border-b-1 border-gray-200">
        <div class="flex justify-start gap-3 items-center">
          <NcButton size="small" type="secondary">
            <component :is="iconMap.doubleLeftArrow" class="h-4 w-4"/>
          </NcButton>
          <span class="font-bold text-gray-700">27 December 2023</span>
          <NcButton size="small" type="secondary">
            <component :is="iconMap.doubleRightArrow" class="h-4 w-4"/>
          </NcButton>
        </div>
        <NcButton v-if="!isMobileMode" size="small" type="secondary" @click="showSideMenu = !showSideMenu">
          <component :is="iconMap.sidebarMinimise" :class="{
            'transform rotate-180': showSideMenu,
          }" class="h-4 w-4 transition-all"/>
        </NcButton>
      </div>
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
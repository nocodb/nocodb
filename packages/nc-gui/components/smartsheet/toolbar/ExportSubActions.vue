<script setup lang="ts">
import { ExportTypes, ViewTypes } from 'nocodb-sdk'

const selectedView = inject(ActiveViewInj)!

const { exportFile, activeExportType } = useViewExport()

// `.ics` export only makes sense for calendar views, which carry the date range
// fields used to build the calendar events.
const isCalendarView = computed(() => selectedView.value?.type === ViewTypes.CALENDAR)
</script>

<template>
  <NcMenuItemLabel>
    {{ $t('labels.downloadData') }}
  </NcMenuItemLabel>

  <NcMenuItem v-e="['a:download:csv']" @click.stop="exportFile(ExportTypes.CSV)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.CSV" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeCsvSmall" class="w-4" />
      <!-- Download as CSV -->
      CSV
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:json']" @click.stop="exportFile(ExportTypes.JSON)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.JSON" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeJson" class="w-4" />
      <!-- Download as JSON -->
      JSON
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:excel']" @click.stop="exportFile(ExportTypes.EXCEL)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.EXCEL" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeExcel" class="w-4" />
      <!-- Download as Excel -->
      {{ $t('labels.excel') }}
    </div>
  </NcMenuItem>

  <NcMenuItem
    v-if="isCalendarView"
    v-e="['a:download:ics']"
    data-testid="nc-export-ics"
    @click.stop="exportFile(ExportTypes.ICS)"
  >
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.ICS" size="regular" />
      <GeneralIcon v-else icon="calendar" class="w-4" />
      <!-- Download as iCalendar (.ics) -->
      {{ $t('labels.icsCalendar') }}
    </div>
  </NcMenuItem>
</template>

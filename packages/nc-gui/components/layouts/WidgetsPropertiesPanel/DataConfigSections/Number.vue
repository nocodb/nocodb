<script setup lang="ts">
import type { NumberWidget } from 'nocodb-sdk'
import { availableAggregateFunctionsWithIdAndTitle } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const {
  changeAggregateFunctionOfFocusedWidget,
  changeSelectedNumberColumnIdOfFocusedWidget,
  changeRecordCountOrFieldSummaryForNumberWidgetDataConfig,
} = dashboardStore

const { focusedWidget, availableNumericColumnsOfSelectedView } = storeToRefs(dashboardStore)

const numberWidget = computed(() => focusedWidget.value as NumberWidget | undefined)
const recordCountOrFieldSummary = computed(() => numberWidget.value?.data_config.recordCountOrFieldSummary)

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableNumericColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel" header="Step 1: Select Table and View">
      <LayoutsWidgetsPropertiesPanelProjectTableViewSelectorSection />
    </a-collapse-panel>
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel" header="Step 2: Select Records">
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter />
    </a-collapse-panel>
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel !rounded-lg" header="Step 3: Rollup function">
      <div class="flex flex-col m-0">
        <div class="nc-dashboard-layouts-propspanel-selectable-config-section mb-2">
          <a-radio
            :checked="recordCountOrFieldSummary === 'record_count'"
            @change="changeRecordCountOrFieldSummaryForNumberWidgetDataConfig('record_count')"
            ><h3>Record count</h3></a-radio
          >
          <h4>Number of records in the table</h4>
          <div v-if="recordCountOrFieldSummary === 'record_count'"></div>
        </div>

        <div class="nc-dashboard-layouts-propspanel-selectable-config-section">
          <a-radio
            :checked="recordCountOrFieldSummary === 'field_summary'"
            @change="changeRecordCountOrFieldSummaryForNumberWidgetDataConfig('field_summary')"
            ><h3>Field summary</h3></a-radio
          >
          <h4>Number of records in the table, from:</h4>
          <div v-if="recordCountOrFieldSummary === 'field_summary'">
            <div class="flex justify-between items-center mb-2">
              <label for="field">Field</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="field"
                v-model="numberWidget.data_config.colId"
                :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
                @change-selected-value="changeSelectedNumberColumnIdOfFocusedWidget($event)"
              />
            </div>
            <div class="flex justify-between items-center">
              <label for="summarize">Summarize</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="summarize"
                v-model="numberWidget.data_config.aggregateFunction"
                :id-and-title-tuple-list="availableAggregateFunctionsWithIdAndTitle"
                @change-selected-value="changeAggregateFunctionOfFocusedWidget($event)"
              />
            </div>
          </div>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss">
:deep(.ant-collapse-content-box) {
}

:deep(.ant-radio-wrapper) {
  @apply m-0 mb-2;
}
:deep(.ant-collapse-header) {
  @apply !text-sm !2xl:text-base;
}
</style>

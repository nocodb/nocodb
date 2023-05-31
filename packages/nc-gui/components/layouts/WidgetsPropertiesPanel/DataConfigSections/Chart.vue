<script setup lang="ts">
import type { DataConfigAggregated2DChart } from '~~/../nocodb-sdk/build/main'

const dashboardStore = useDashboardStore()
const {
  changeSelectedYColumnIdOfFocusedWidget,
  changeAggregateFunctionOfFocusedWidget,
  changeRecordCountOrFieldSummaryForNumberWidgetDataConfig,
} = dashboardStore
const { focusedWidget, availableNumericColumnsOfSelectedView } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigAggregated2DChart)

const availableNumericColumnsOfSelectedViewWithTitles = computed(() => {
  return availableNumericColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})

const recordCountOrFieldSummary = computed(() => dataConfig.value?.recordCountOrFieldSummary)
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-collapse-panel-custom">
    <a-collapse-panel class="nc-collapse-panel" header="Step 1: Select Table and View">
      <LayoutsWidgetsPropertiesPanelProjectTableViewSelectorSection />
    </a-collapse-panel>
    <a-collapse-panel class="nc-collapse-panel" header="Step 2: Select Records">
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter />
    </a-collapse-panel>
    <a-collapse-panel class="nc-collapse-panel !rounded-lg" header="Step 3: Setup X-axis">
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsXAxis />
    </a-collapse-panel>
    <a-collapse-panel class="nc-collapse-panel !rounded-lg" header="Step 4: Setup Y-axis">
      <div class="flex flex-col m-0">
        <div class="bg-gray-100 rounded-lg p-2 mb-2">
          <a-radio
            :checked="recordCountOrFieldSummary === 'record_count'"
            @change="changeRecordCountOrFieldSummaryForNumberWidgetDataConfig('record_count')"
            ><h3>Record count</h3></a-radio
          >
          <h3 class="text-gray-500">Number of records in the table</h3>
          <div v-if="recordCountOrFieldSummary === 'record_count'"></div>
        </div>

        <div class="bg-gray-100 rounded-lg p-2">
          <a-radio
            :checked="recordCountOrFieldSummary === 'field_summary'"
            @change="changeRecordCountOrFieldSummaryForNumberWidgetDataConfig('field_summary')"
            ><h3>Field summary</h3></a-radio
          >
          <h3 class="text-gray-500">Number of records in the table, from:</h3>
          <div v-if="recordCountOrFieldSummary === 'field_summary'">
            <div class="flex justify-between items-center mb-2">
              <label for="field">Field</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="field"
                v-model="dataConfig.yAxisColId"
                :id-and-title-tuple-list="availableNumericColumnsOfSelectedViewWithTitles"
                label-text="Y axis"
                @change-selected-value="changeSelectedYColumnIdOfFocusedWidget($event)"
              />
            </div>
            <div class="flex justify-between items-center mb-2">
              <label for="summarize">Summarize</label>
              <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
                id="summarize"
                v-model="dataConfig.aggregateFunction"
                :id-and-title-tuple-list="availableAggregateFunctionsWithIdAndTitle"
                label-text="Aggregate function"
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
.nc-collapse-panel {
  @apply border border-solid border-grey-light rounded-lg my-2;
}
.nc-collapse-panel-custom {
  background-color: transparent;
}
:deep(.ant-collapse-content-box) {
}

:deep(.ant-radio-wrapper) {
  @apply m-0 mb-2;
}
</style>

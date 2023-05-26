<script setup lang="ts">
import type { DataConfigAggregated2DChart } from '~~/../nocodb-sdk/build/main'

const dashboardStore = useDashboardStore()
const { changeSelectedXColumnIdOfFocusedWidget, changeSelectedYColumnIdOfFocusedWidget, changeAggregateFunctionOfFocusedWidget } =
  dashboardStore
const { focusedWidget, availableNumericColumnsOfSelectedView, availableColumnsOfSelectedView } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigAggregated2DChart)

const availableNumericColumnsOfSelectedViewWithTitles = computed(() => {
  return availableNumericColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})
</script>

<template>
  <a-collapse expand-icon-position="right" accordion class="nc-dashboard-props-panel-collapse-group">
    <a-collapse-panel header="Step 1: Select Table and View">
      <LayoutsWidgetsPropertiesPanelProjectTableViewSelectorSection />
      <template #extra><setting-outlined /></template>
    </a-collapse-panel>
    <a-collapse-panel header="Step 2: Select Records">
      <template #extra><setting-outlined /></template>
      <div><LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter /></div>
    </a-collapse-panel>
    <a-collapse-panel header="Step 3: Setup X-axis">
      <template #extra><setting-outlined /></template>
      <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="dataConfig.xAxisColId"
        :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
        label-text="X axis"
        @change-selected-value="changeSelectedXColumnIdOfFocusedWidget($event)"
      />
    </a-collapse-panel>
    <a-collapse-panel header="Step 4: Setup Y-axis">
      <template #extra><setting-outlined /></template>
      <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="dataConfig.yAxisColId"
        :id-and-title-tuple-list="availableNumericColumnsOfSelectedViewWithTitles"
        label-text="Y axis"
        @change-selected-value="changeSelectedYColumnIdOfFocusedWidget($event)"
      />
      <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="dataConfig.aggregateFunction"
        :id-and-title-tuple-list="availableAggregateFunctionsWithIdAndTitle"
        label-text="Aggregate function"
        @change-selected-value="changeAggregateFunctionOfFocusedWidget($event)"
      />
    </a-collapse-panel>
  </a-collapse>
</template>

<style></style>

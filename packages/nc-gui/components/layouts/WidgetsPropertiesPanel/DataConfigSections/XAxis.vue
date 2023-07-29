<script lang="ts" setup>
import type { DataConfigAggregated2DChart } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const {
  changeSelectedXColumnIdOfFocusedWidget,
  changeSelectedXAxisOrderByOfFocusedWidget,
  changexAxisOrderDirectionOfFocusedWidget,
} = dashboardStore
const { focusedWidget, availableColumnsOfSelectedView } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigAggregated2DChart)

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})

const idAndTitlesForxAxisOrderBy = [
  {
    id: 'x_val',
    title: 'X axis',
  },
  {
    id: 'y_val',
    title: 'Y axis',
  },
]

const idAndTitlesForxAxisOrderDirection = [
  {
    id: 'asc',
    title: 'Ascending',
  },
  {
    id: 'desc',
    title: 'Descending',
  },
]
</script>

<template>
  <div class="flex justify-between items-center mb-2">
    <label for="xAxis">Field</label>
    <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
      id="xAxis"
      v-model="dataConfig.xAxisColId"
      :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
      @change-selected-value="changeSelectedXColumnIdOfFocusedWidget($event)"
    />
  </div>
  <div class="flex justify-between items-center mb-2">
    <label for="xAxisOrderBy">Order by</label>
    <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
      id="xAxisOrderBy"
      v-model="dataConfig.xAxisOrderBy"
      :id-and-title-tuple-list="idAndTitlesForxAxisOrderBy"
      @change-selected-value="changeSelectedXAxisOrderByOfFocusedWidget($event)"
    />
  </div>
  <div class="flex justify-between items-center">
    <label for="xAxisOrderDirection">Direction</label>
    <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
      id="xAxisOrderDirection"
      v-model="dataConfig.xAxisOrderDirection"
      :id-and-title-tuple-list="idAndTitlesForxAxisOrderDirection"
      @change-selected-value="changexAxisOrderDirectionOfFocusedWidget($event)"
    />
  </div>
</template>

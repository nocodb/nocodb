<script lang="ts" setup>
import type { DataConfigAggregated2DChart } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeSelectedXColumnIdOfFocusedWidget } = dashboardStore
const { focusedWidget, availableColumnsOfSelectedView } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigAggregated2DChart)

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})
</script>

<template>
  <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
    v-model="dataConfig.yAxisOrderBy"
    :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
    label-text="X axis"
    @change-selected-value="changeSelectedXColumnIdOfFocusedWidget($event)"
  />
</template>

<script lang="ts" setup>
import type { DataSourceInternal } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { focusedWidget, availableViewsOfSelectedTable } = storeToRefs(dashboardStore)

const { changeSelectedViewIdOfFocusedWidget } = dashboardStore

// TODO: also add here support for other data source types than internal

const internalDataSource = computed(() => focusedWidget.value?.data_source as DataSourceInternal | undefined)
</script>

<template>
  <template v-if="internalDataSource">
    <LayoutsWidgetsPropertiesPanelVisualisationConfigTablesGroupedByProjectsSelectBox />

    <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
      v-model="internalDataSource.viewId"
      :id-and-title-tuple-list="availableViewsOfSelectedTable"
      label-text="View"
      @change-selected-value="changeSelectedViewIdOfFocusedWidget($event)"
    />
  </template>
</template>

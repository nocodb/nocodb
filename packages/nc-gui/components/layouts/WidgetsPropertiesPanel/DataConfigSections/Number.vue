<script setup lang="ts">
import type { NumberWidget } from 'nocodb-sdk'
import { availableAggregateFunctionsWithIdAndTitle } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const { changeAggregateFunctionOfFocusedWidget, changeSelectedNumberColumnIdOfFocusedWidget } = dashboardStore

const { focusedWidget, availableNumericColumnsOfSelectedView } = storeToRefs(dashboardStore)

const numberWidget = computed(() => focusedWidget.value as NumberWidget | undefined)

const availableColumnsOfSelectedViewWithTitles = computed(() => {
  return availableNumericColumnsOfSelectedView.value?.map((column) => ({
    id: column.id,
    title: column.column_name,
  }))
})
</script>

<template>
  <a-collapse expand-icon-position="right" accordion>
    <a-collapse-panel header="Step 1: Select Table and View">
      <LayoutsWidgetsPropertiesPanelProjectTableViewSelectorSection />
    </a-collapse-panel>
    <a-collapse-panel header="Step 2: Select Records">
      <div><LayoutsWidgetsPropertiesPanelDataConfigSectionsFilter /></div>
    </a-collapse-panel>
    <a-collapse-panel header="Step 3: Rollup function">
      <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="numberWidget.data_config.colId"
        :id-and-title-tuple-list="availableColumnsOfSelectedViewWithTitles"
        label-text="Number field"
        @change-selected-value="changeSelectedNumberColumnIdOfFocusedWidget($event)"
      />
      <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="numberWidget.data_config.aggregateFunction"
        :id-and-title-tuple-list="availableAggregateFunctionsWithIdAndTitle"
        label-text="Aggregate function"
        @change-selected-value="changeAggregateFunctionOfFocusedWidget($event)"
      />
    </a-collapse-panel>
  </a-collapse>
</template>

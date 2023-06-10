<script setup lang="ts">
import { StaticTextWidget } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeFontTypeOfFocusedWidget } = dashboardStore
const { focusedWidget, availableFontTypesWithIdAndTitle } = storeToRefs(dashboardStore)
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel !rounded-lg" header="Text Options">
      <template #extra><setting-outlined /></template>
      <DashboardsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="(focusedWidget as StaticTextWidget).appearance_config.fontType"
        :id-and-title-tuple-list="availableFontTypesWithIdAndTitle"
        label-text="Font Type"
        @change-selected-value="changeFontTypeOfFocusedWidget($event)"
      />
    </a-collapse-panel>
  </a-collapse>
</template>

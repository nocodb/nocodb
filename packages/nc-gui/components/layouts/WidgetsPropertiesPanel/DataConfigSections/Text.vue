<script setup lang="ts">
import { StaticTextWidget } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeTextOfFocusedTextElement } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)
</script>

<template>
  <label for="nc-dashboard-property-panel-text-value">Text</label>
  <a-textarea
    id="nc-dashboard-property-panel-text-value"
    :value="(focusedWidget as StaticTextWidget).data_config.text"
    @update:value="changeTextOfFocusedTextElement($event)"
  ></a-textarea>
</template>

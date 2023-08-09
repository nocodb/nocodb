<script setup lang="ts">
import type { DataConfigAggregated2DChart } from 'nocodb-sdk'
import { ref, watch } from 'vue'

const dashboardStore = useDashboardStore()
const { changeNameOfFocusedChart } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigAggregated2DChart)

const localText = ref(dataConfig.value?.name ?? '')

watch(dataConfig, (newConfig) => {
  localText.value = newConfig?.name ?? ''
})
</script>

<template>
  <a-input
    v-model:value="localText"
    placeholder="Value"
    class="nc-dashboard-layouts-propspanel-value-input"
    @blur="() => changeNameOfFocusedChart(localText)"
  />
</template>

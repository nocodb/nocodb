<script setup lang="ts">
import type { DataConfigButton } from 'nocodb-sdk'
import { ref, watch } from 'vue'

const dashboardStore = useDashboardStore()
const { changeButtonTextOfFocusedButtonWidget } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigButton)

const localButtonText = ref(dataConfig.value?.buttonText ?? '')

watch(dataConfig, (newConfig) => {
  localButtonText.value = newConfig?.buttonText
})
</script>

<template>
  <a-input
    v-model:value="localButtonText"
    placeholder="Value"
    class="nc-dashboard-layouts-propspanel-value-input"
    @blur="() => changeButtonTextOfFocusedButtonWidget(localButtonText)"
  />
</template>

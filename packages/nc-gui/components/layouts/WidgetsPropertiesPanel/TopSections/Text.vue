<script setup lang="ts">
import type { DataConfigStaticText } from 'nocodb-sdk'
import { ref, watch } from 'vue'

const dashboardStore = useDashboardStore()
const { changeTextOfFocusedTextElement } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigStaticText)

const localText = ref(dataConfig.value?.text ?? '')

watch(dataConfig, (newConfig) => {
  localText.value = newConfig?.text
})
</script>

<template>
  <a-input
    v-model:value="localText"
    placeholder="Value"
    class="nc-dashboard-layouts-propspanel-value-input"
    @blur="() => changeTextOfFocusedTextElement(localText)"
  />
</template>

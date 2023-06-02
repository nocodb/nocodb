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
    class="nc-value-input"
    @blur="() => changeTextOfFocusedTextElement(localText)"
  />
</template>

<style>
.nc-value-input {
  @apply flex-grow py-1 px-3 border-grey-light border border-solid rounded-lg text-sm w-full my-2;
}

.nc-description-input {
  @apply flex-grow py-1 px-3 !border-gray-200 border border-solid rounded-lg text-sm w-full my-2;
}
</style>

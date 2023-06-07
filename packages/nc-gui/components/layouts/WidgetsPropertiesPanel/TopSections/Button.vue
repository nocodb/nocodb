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
    class="nc-value-input"
    @blur="() => changeButtonTextOfFocusedButtonWidget(localButtonText)"
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

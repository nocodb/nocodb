<script setup lang="ts">
import type { DataConfigNumber } from 'nocodb-sdk'
import { ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

const dashboardStore = useDashboardStore()
const { changeNameOfNumberWidget, changeDescriptionOfNumberWidget } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const dataConfig = computed(() => focusedWidget.value?.data_config as DataConfigNumber)

const localName = ref(dataConfig.value?.name ?? '')
const localDescription = ref(dataConfig.value?.description ?? '')

watch(dataConfig, (newConfig) => {
  localName.value = newConfig?.name
  localDescription.value = newConfig?.description
})
</script>

<template>
  <a-input
    v-model:value="localName"
    placeholder="Value"
    class="nc-dashboard-layouts-propspanel-value-input"
    @blur="() => changeNameOfNumberWidget(localName)"
  >
    <template #suffix>
      <Icon class="text-xl iconify" icon="material-symbols:edit-outline" color="#565B66"></Icon>
    </template>
  </a-input>
  <a-textarea
    v-model:value="localDescription"
    placeholder="Description"
    class="nc-dashboard-layouts-propspanel-description-input"
    @blur="() => changeDescriptionOfNumberWidget(localDescription)"
  >
    <template #suffix>
      <Icon class="text-xl iconify" icon="material-symbols:edit-outline" color="#565B66"></Icon>
    </template>
  </a-textarea>
</template>

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
  <a-input v-model:value="localName" placeholder="Value" class="nc-value-input" @blur="() => changeNameOfNumberWidget(localName)">
    <template #suffix>
      <Icon class="text-xl iconify" icon="material-symbols:edit-outline" color="#565B66"></Icon>
    </template>
  </a-input>
  <a-textarea
    v-model:value="localDescription"
    placeholder="Description"
    class="nc-description-input"
    @blur="() => changeDescriptionOfNumberWidget(localDescription)"
  >
    <template #suffix>
      <Icon class="text-xl iconify" icon="material-symbols:edit-outline" color="#565B66"></Icon>
    </template>
  </a-textarea>
</template>

<style>
.nc-value-input {
  @apply flex-grow py-1 px-3 border-grey-light border border-solid rounded-lg text-sm w-full my-2;
}

.nc-description-input {
  @apply flex-grow py-1 px-3 !border-gray-200 border border-solid rounded-lg text-sm w-full my-2;
}
</style>

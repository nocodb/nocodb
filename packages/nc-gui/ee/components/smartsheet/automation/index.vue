<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

// Define SmartsheetAutomationScripts as an async component
const SmartsheetAutomationScripts = defineAsyncComponent(() => import('./scripts/index.vue'))

const automationStore = useAutomationStore()
const { updateBaseSchema } = automationStore
const { isLoadingAutomation } = storeToRefs(automationStore)

onMounted(async () => {
  await updateBaseSchema()
})
</script>

<template>
  <div style="height: calc(100svh)" class="nc-container flex flex-col h-full">
    <LazySmartsheetTopbar />
    <template v-if="!isLoadingAutomation">
      <Suspense>
        <SmartsheetAutomationScripts />
        <template #fallback>
          <div class="flex items-center justify-center h-full">
            <GeneralLoader size="xlarge" />
          </div>
        </template>
      </Suspense>
    </template>
    <div v-else class="flex items-center justify-center h-full">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>

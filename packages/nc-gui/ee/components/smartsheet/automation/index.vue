<script setup lang="ts">
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
    <LazySmartsheetAutomationScripts v-if="!isLoadingAutomation" />
    <div v-else class="flex items-center justify-center h-full">
      <GeneralLoader size="xlarge" />
    </div>
  </div>
</template>

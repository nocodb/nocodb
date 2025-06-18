<script setup lang="ts">
const { activeBaseSchema } = storeToRefs(useAutomationStore())

await until(() => !!activeBaseSchema.value).toBeTruthy()
</script>

<template>
  <div style="height: calc(100svh)" class="nc-container flex flex-col h-full">
    <LazySmartsheetTopbar />
    <LazySmartsheetAutomationScripts />
  </div>
</template>

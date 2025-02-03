<script setup lang="ts">
const automationStore = useAutomationStore()

const { activeAutomation } = storeToRefs(automationStore)

useProvideScriptStore({
  script: activeAutomation.value,
})
</script>

<template>
  <LazySmartsheetAutomation />
</template>

<script setup lang="ts">
const automationStore = useAutomationStore()

const { activeAutomation } = storeToRefs(automationStore)

useProvideScriptStore(activeAutomation)
</script>

<template>
  <SmartsheetAutomation />
</template>

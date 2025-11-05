<script setup lang="ts">
const workflowStore = useWorkflowStore()

const { activeWorkflow } = storeToRefs(workflowStore)

useProvideWorkflowStore(activeWorkflow)
</script>

<template>
  <SmartsheetWorkflow />
</template>

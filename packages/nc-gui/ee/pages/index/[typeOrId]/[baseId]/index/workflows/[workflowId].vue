<script setup lang="ts">
import { useProvideWorkflow } from '~/composables/useWorkflow'

const workflowStore = useWorkflowStore()

const { activeWorkflow } = storeToRefs(workflowStore)

useProvideWorkflow(activeWorkflow)
</script>

<template>
  <div class="flex flex-col h-full">
    <SmartsheetTopbar />
    <div style="height: calc(100dvh - var(--topbar-height))">
      <SmartsheetWorkflow />
    </div>
  </div>
</template>

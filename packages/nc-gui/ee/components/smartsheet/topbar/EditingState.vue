<script setup lang="ts">
const { isEditingDashboard } = storeToRefs(useDashboardStore())

const { activeWorkflowHasDraftChanges } = storeToRefs(useWorkflowStore())
</script>

<template>
  <div
    v-if="isEditingDashboard || activeWorkflowHasDraftChanges"
    class="flex items-center text-nc-content-brand leading-5 font-normal"
  >
    {{ isEditingDashboard ? 'You are now editing this dashboard' : 'Workflow has unpublished changes' }}
  </div>
</template>

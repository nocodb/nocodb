<script setup lang="ts">
const workflowStore = useWorkflowStore()
const { isLoadingWorkflow } = storeToRefs(workflowStore)
</script>

<template>
  <div style="height: calc(100svh)" class="nc-container flex flex-col h-full">
    <template v-if="!isLoadingWorkflow">
      <Suspense>
        <SmartsheetWorkflowMain />
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

<script setup lang="ts">
const route = useRoute()

const workflowStore = useWorkflowStore()

const { edges, nodes } = useWorkflowOrThrow()

const { loadWorkflow } = workflowStore

const { activeWorkflow } = storeToRefs(workflowStore)

const isLoading = ref(true)

onMounted(async () => {
  const workflowId = route.params.workflowId as string
  if (workflowId && !activeWorkflow.value?.id) {
    isLoading.value = true

    const workflow = await loadWorkflow(workflowId)

    if (!workflow) {
      isLoading.value = false
      return
    }

    nodes.value = (workflow.nodes || []) as any

    edges.value = (workflow.edges || []) as any

    isLoading.value = false
  } else {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="flex bg-nc-bg-gray-extralight main-content flex-1">
    <div
      class="flex-1 h-full relative overflow-y-auto"
      :class="{
        'flex items-center justify-center': isLoading,
      }"
    >
      <GeneralOverlay
        v-show="isLoading"
        :model-value="isLoading"
        inline
        transition
        class="!bg-opacity-15 rounded-xl overflow-hidden"
      >
        <div class="flex flex-col items-center justify-center h-full w-full !bg-nc-bg-default !bg-opacity-80">
          <a-spin size="large" />
        </div>
      </GeneralOverlay>
      <SmartsheetWorkflowMain v-if="activeWorkflow" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.main-content {
  height: calc(100vh - var(--topbar-height));
}
</style>

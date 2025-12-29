<script setup lang="ts">
interface IterateNodeConfig {
  array: string
}

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const config = computed<IterateNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    array: '',
  }) as IterateNodeConfig
})

const updateConfig = (updates: Partial<IterateNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
    },
  })
}

const updateArray = (array: string) => {
  updateConfig({ array })
}
</script>

<template>
  <div class="iterate-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">List</label>
      <NcFormBuilderInputWorkflowInput
        :model-value="config.array"
        :variables="flatVariables"
        :grouped-variables="groupedVariables"
        placeholder="Select an array to iterate over"
        @update:model-value="updateArray"
      />
      <div class="text-xs text-nc-content-gray-muted">
        Select an array from a previous step. Each item will be processed sequentially.
      </div>
    </div>
  </div>
</template>

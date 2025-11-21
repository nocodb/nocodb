<script setup lang="ts">
import { IntegrationsType } from 'nocodb-sdk'
const { selectedNodeId, updateNode, getNodeMetaById, selectedNode, fetchNodeIntegrationOptions } = useWorkflowOrThrow()

const formSchema = computed(() => {
  if (!selectedNode.value || !selectedNode.value.type) return []
  const nodeMeta = getNodeMetaById(selectedNode.value.type)
  return nodeMeta?.form || []
})

const { formState } = useProvideFormBuilderHelper({
  formSchema,
  initialState: computed(() => selectedNode.value?.data || {}),
  onChange: () => {
    if (!selectedNodeId.value) return
    updateNode(selectedNodeId.value, {
      data: formState.value,
    })
  },
  fetchOptions: async (key: string) => {
    return fetchNodeIntegrationOptions(
      {
        ...formState.value,
        type: IntegrationsType.WorkflowNode,
        sub_type: selectedNode.value.type,
      },
      key,
    )
  },
})
</script>

<template>
  <div class="px-4">
    <NcFormBuilder v-if="formSchema.length > 0" />
  </div>
</template>

<style scoped lang="scss"></style>

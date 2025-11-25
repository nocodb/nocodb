<script setup lang="ts">
import { IntegrationsType } from 'nocodb-sdk'
import IfNodeConfig from '~/components/smartsheet/workflow/Node/IfNode/index.vue'

const {
  selectedNodeId,
  updateNode,
  getNodeMetaById,
  selectedNode,
  fetchNodeIntegrationOptions,
  clearChildNodesTestResults,
  getAvailableVariables,
  getAvailableVariablesFlat,
} = useWorkflowOrThrow()

provide(WorkflowVariableInj, {
  selectedNodeId,
  getAvailableVariables,
  getAvailableVariablesFlat,
})

const isIfNode = computed(() => selectedNode.value?.type === 'core.flow.if')

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
      data: {
        ...selectedNode.value?.data,
        ...formState.value,
        testResult: {
          ...(selectedNode.value?.data?.testResult || {}),
          isStale: true,
        },
      },
    })

    clearChildNodesTestResults(selectedNodeId.value)
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
  <div>
    <IfNodeConfig v-if="isIfNode" />
    <div v-else class="px-4 py-4">
      <NcFormBuilder v-if="formSchema.length > 0" />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>

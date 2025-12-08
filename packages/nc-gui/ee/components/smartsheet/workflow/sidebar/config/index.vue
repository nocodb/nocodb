<script setup lang="ts">
import { IntegrationsType } from 'nocodb-sdk'
import IfNodeConfig from '~/components/smartsheet/workflow/sidebar/config/if/index.vue'

const {
  selectedNodeId,
  updateNode,
  getNodeMetaById,
  selectedNode,
  nodes,
  edges,
  fetchNodeIntegrationOptions,
  clearChildNodesTestResults,
} = useWorkflowOrThrow()

/**
 * Get available variables from all upstream nodes for a given node
 * These are the output variables from nodes that have been tested and come before this node
 * @param nodeId - The node ID to get available variables for
 * @returns Array of variable definitions with node context
 */
const getAvailableVariables = (nodeId: string) => {
  const parentNodeIds = findAllParentNodes(nodeId, edges.value)
  const variables: Array<{
    nodeId: string
    nodeTitle: string
    nodeIcon?: string
    variables: any[]
  }> = []

  for (const parentId of parentNodeIds) {
    const parentNode = nodes.value.find((n) => n.id === parentId)
    if (!parentNode) continue

    // Skip nodes without test results or output variables
    const testResult = parentNode.data?.testResult
    if (!testResult?.outputVariables || testResult.outputVariables.length === 0) continue

    // Get node definition to access the icon
    const nodeMeta = getNodeMetaById(parentNode.type)
    const nodeIcon = nodeMeta?.icon

    const nodePrefix = `$('${parentNode.data?.title || parentId}')`

    // Add the node's variables with node context, recursively prefixing all keys
    variables.push({
      nodeId: parentId,
      nodeTitle: parentNode.data?.title || parentId,
      nodeIcon,
      variables: testResult.outputVariables.map((v: any) => ({
        ...prefixVariableKeysRecursive(v, nodePrefix),
        extra: {
          ...v.extra,
          sourceNodeId: parentId,
          sourceNodeTitle: parentNode.data?.title || parentId,
          nodeIcon,
        },
      })),
    })
  }

  return variables
}

/**
 * Get a flat list of all available variables for a node
 * @param nodeId - The node ID to get available variables for
 * @returns Flat array of variable definitions
 */
const getAvailableVariablesFlat = (nodeId: string) => {
  const groupedVariables = getAvailableVariables(nodeId)
  return groupedVariables.flatMap((group) => group.variables)
}

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
  <NcGroupedSettings v-if="formSchema.length > 0 || isIfNode" title="Inputs">
    <IfNodeConfig v-if="isIfNode" />
    <NcFormBuilder v-else-if="formSchema.length > 0" />
  </NcGroupedSettings>
</template>

<style scoped lang="scss"></style>

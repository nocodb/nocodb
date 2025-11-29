<script setup lang="ts">
import { WorkflowNodeCategory } from 'nocodb-sdk'

const { getNodeMetaById, selectedNode, selectedNodeId, edges, nodes, testExecuteNode } = useWorkflowOrThrow()

const isTestingNode = ref()

const findAllAncestors = (nodeId: string): Set<string> => {
  const ancestors = new Set<string>()
  const visited = new Set<string>()

  const traverse = (currentId: string) => {
    if (visited.has(currentId)) return
    visited.add(currentId)

    const parentEdges = edges.value.filter((edge) => edge.target === currentId)

    for (const edge of parentEdges) {
      if (edge.source) {
        ancestors.add(edge.source)
        traverse(edge.source)
      }
    }
  }

  traverse(nodeId)
  return ancestors
}

const untestedParentNodes = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return []

  const ancestorIds = findAllAncestors(selectedNodeId.value)

  return nodes.value
    .filter((node) => ancestorIds.has(node.id) && (!node.data?.testResult || node.data.testResult.status !== 'success'))
    .map((node) => node.data?.title || node.id)
})

const isTriggerNode = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.category === WorkflowNodeCategory.TRIGGER
})

const canTestNode = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return false

  const ancestorIds = findAllAncestors(selectedNodeId.value)

  if (ancestorIds.size === 0) {
    return true
  }

  return Array.from(ancestorIds).every((ancestorId) => {
    const ancestorNode = nodes.value.find((n) => n.id === ancestorId)
    return ancestorNode?.data?.testResult?.status === 'success'
  })
})

const handleTestNode = async () => {
  isTestingNode.value = true
  try {
    await testExecuteNode(selectedNodeId.value)
  } finally {
    isTestingNode.value = false
  }
}
</script>

<template>
  <NcGroupedSettings title="Test Step">
    <div class="text-nc-content-gray-muted">
      <template v-if="isTriggerNode">
        Test this trigger to confirm its configuration is correct. The data from this test can be used in later steps.
      </template>
      <template v-else>
        Test this action to confirm it works as expected. This will use data from previous tested steps.
      </template>
    </div>
    <div class="w-full flex justify-end">
      <NcTooltip placement="bottom" :disabled="canTestNode || untestedParentNodes.length === 0">
        <NcButton type="secondary" size="small" :disabled="!canTestNode" :loading="isTestingNode" @click="handleTestNode">
          <template v-if="isTriggerNode"> Use suggested record to test </template>
          <template v-else> Test this action </template>
        </NcButton>

        <template #title>
          <div class="font-medium mb-1">⚠️ Previous nodes need testing first:</div>
          <ul v-if="untestedParentNodes.length > 0" class="list-disc pl-5">
            <li v-for="nodeName in untestedParentNodes" :key="nodeName">{{ nodeName }}</li>
          </ul>
        </template>
      </NcTooltip>
    </div>
  </NcGroupedSettings>
</template>

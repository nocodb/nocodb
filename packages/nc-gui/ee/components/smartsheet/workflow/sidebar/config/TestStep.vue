<script setup lang="ts">
import { WorkflowNodeCategory } from 'nocodb-sdk'

const { getNodeMetaById, selectedNode, selectedNodeId, edges, nodes, testExecuteNode } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const localTestState = ref<'idle' | 'testing' | 'success' | 'error'>('idle')

const testState = computed(() => {
  if (selectedNode.value?.data?.testResult && selectedNode.value.data.testResult?.isStale !== true) {
    return selectedNode.value.data.testResult.status === 'success' ? 'success' : 'error'
  }
  return localTestState.value
})

const localErrorMessage = ref('')

const errorMessage = computed(() => {
  return selectedNode.value?.data?.testResult?.error?.message || localErrorMessage.value
})

const untestedParentNodes = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return []

  const ancestorIds = new Set(findAllParentNodes(selectedNodeId.value, edges.value))

  return nodes.value
    .filter((node) => ancestorIds.has(node.id) && (!node.data?.testResult || node.data.testResult.status !== 'success'))
    .map((node) => node.data?.title || node.id)
})

const isTriggerNode = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.category === WorkflowNodeCategory.TRIGGER
})

const isNocoDBRecordTriggerNode = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.id?.includes?.('nocodb.trigger.after')
})

const canTestNode = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return false

  const ancestorIds = findAllParentNodes(selectedNodeId.value, edges.value)

  if (ancestorIds.length === 0) {
    return true
  }

  return ancestorIds.every((ancestorId) => {
    const ancestorNode = nodes.value.find((n) => n.id === ancestorId)
    return ancestorNode?.data?.testResult?.status === 'success'
  })
})

const handleTestNode = async () => {
  localTestState.value = 'testing'
  localErrorMessage.value = ''
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)

  $e('a:workflow:node:test', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value)
    if (res.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta?.category,
      })
    } else {
      localTestState.value = 'error'
      localErrorMessage.value = res.error
    }
  } catch (er) {
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er))?.message || 'Unknown error occurred'
    $e('a:workflow:node:test:error', {
      node_type: selectedNode.value?.type,
      node_category: nodeMeta?.category,
    })
  }
}

watch(selectedNode, () => {
  localTestState.value = 'idle'
  localErrorMessage.value = ''
})
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
      <NcTooltip placement="bottom" :disabled="(canTestNode || untestedParentNodes.length === 0) && testState !== 'error'">
        <NcButton
          type="secondary"
          size="small"
          :disabled="!canTestNode"
          :loading="testState === 'testing'"
          icon-position="right"
          @click="handleTestNode"
        >
          <template #icon>
            <GeneralIcon
              v-if="testState === 'success'"
              icon="circleCheckSolid"
              class="!text-nc-content-green-dark w-4 h-4 flex-none"
            />
            <GeneralIcon
              v-else-if="testState === 'error'"
              icon="alertTriangleSolid"
              class="!text-nc-content-red-dark w-4 h-4 flex-none"
            />
          </template>
          <span>
            <template v-if="testState === 'success'"> Test successful </template>
            <template v-else-if="isNocoDBRecordTriggerNode">Use suggested record to test</template>
            <template v-else-if="isTriggerNode"> Test this trigger </template>
            <template v-else> Test this action </template>
          </span>
        </NcButton>

        <template #title>
          <template v-if="testState === 'error'">
            {{ errorMessage }}
          </template>
          <template v-else>
            <div class="font-medium mb-1">⚠️ Previous nodes need testing first:</div>
            <ul v-if="untestedParentNodes.length > 0" class="list-disc pl-5">
              <li v-for="nodeName in untestedParentNodes" :key="nodeName">{{ nodeName }}</li>
            </ul>
          </template>
        </template>
      </NcTooltip>
    </div>
  </NcGroupedSettings>
</template>

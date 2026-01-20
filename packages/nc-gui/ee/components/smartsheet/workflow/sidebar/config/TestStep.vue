<script setup lang="ts">
import { GeneralNodeID, TriggerTestMode, WorkflowNodeCategory } from 'nocodb-sdk'

const { appInfo } = useGlobal()
const { getNodeMetaById, selectedNode, selectedNodeId, edges, nodes, testExecuteNode, workflow } = useWorkflowOrThrow()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const baseStore = useBases()
const { activeProjectId } = storeToRefs(baseStore)

const { $e } = useNuxtApp()
const { copy } = useCopy()

const localTestState = ref<'idle' | 'testing' | 'listening' | 'listening_event' | 'success' | 'error'>()
const localErrorMessage = ref('')
const isListening = ref(false)

const testState = computed(() => {
  if (localTestState.value) return localTestState.value
  if (selectedNode.value?.data?.testResult && selectedNode.value.data.testResult?.isStale !== true) {
    return selectedNode.value.data.testResult.status === 'success' ? 'success' : 'error'
  }
  return localTestState.value
})

const lastTestMode = computed(() => selectedNode.value?.data?.testResult?.testMode)

const errorMessage = computed(() => {
  return selectedNode.value?.data?.testResult?.error || localErrorMessage.value
})

const nodeMeta = computed(() => getNodeMetaById(selectedNode.value?.type))

const isTriggerNode = computed(() => nodeMeta.value?.category === WorkflowNodeCategory.TRIGGER)

const isNocoDBRecordTriggerNode = computed(() => nodeMeta.value?.id?.includes?.('nocodb.trigger.after'))

const supportsSampleData = computed(() =>
  nodeMeta.value?.testModes?.length ? nodeMeta.value?.testModes?.includes(TriggerTestMode.SAMPLE_DATA) : true,
)

const supportsListenWebhook = computed(() => nodeMeta.value?.testModes?.includes(TriggerTestMode.LISTEN_WEBHOOK))

const supportsTriggerEvent = computed(() => nodeMeta.value?.testModes?.includes(TriggerTestMode.TRIGGER_EVENT))

const webhookUrl = computed(() => {
  if (!supportsListenWebhook.value || !selectedNode.value) return null
  const triggerId = selectedNode.value.data?.triggerId
  if (!triggerId) return null
  return `${appInfo.value?.ncSiteUrl}/api/v3/workflows/${activeWorkspaceId.value}/${activeProjectId.value}/${workflow.value?.id}/${triggerId}/webhook`
})

const untestedParentNodes = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return []
  const ancestorIds = new Set(findAllParentNodes(selectedNodeId.value, edges.value))
  return nodes.value
    .filter((node) => {
      if (node.type === GeneralNodeID.NOTE) return false
      return ancestorIds.has(node.id) && (!node.data?.testResult || node.data.testResult.status !== 'success')
    })
    .map((node) => node.data?.title || node.id)
})

const canTestNode = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return false
  const ancestorIds = findAllParentNodes(selectedNodeId.value, edges.value)
  if (ancestorIds.length === 0) return true
  return ancestorIds.every((ancestorId) => {
    const ancestorNode = nodes.value.find((n) => n.id === ancestorId)
    const testResult = ancestorNode?.data?.testResult
    return testResult?.status === 'success' && testResult.isStale !== true
  })
})

const handleTestNode = async () => {
  localTestState.value = 'testing'
  localErrorMessage.value = ''

  $e('a:workflow:node:test', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta.value?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value)
    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta.value?.category,
      })
    } else {
      localTestState.value = 'error'
      localErrorMessage.value = res?.error
    }
  } catch (er) {
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er))?.message || 'Unknown error occurred'
    $e('a:workflow:node:test:error', {
      node_type: selectedNode.value?.type,
      node_category: nodeMeta.value?.category,
    })
  }
}

const handleWebhookTest = async () => {
  if (!webhookUrl.value) {
    localErrorMessage.value = 'Webhook URL not available. Please ensure the trigger is configured.'
    localTestState.value = 'error'
    return
  }

  localTestState.value = 'listening'
  localErrorMessage.value = ''
  isListening.value = true

  $e('a:workflow:node:test:webhook', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta.value?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value)
    isListening.value = false

    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:webhook:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta.value?.category,
      })
    } else {
      localTestState.value = 'error'
      localErrorMessage.value = res?.error
    }
  } catch (er) {
    isListening.value = false
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er))?.message || 'Unknown error occurred'
    $e('a:workflow:node:test:webhook:error', {
      node_type: selectedNode.value?.type,
      node_category: nodeMeta.value?.category,
    })
  }
}

const handleTriggerEventTest = async () => {
  localTestState.value = 'listening_event'
  localErrorMessage.value = ''
  isListening.value = true

  $e('a:workflow:node:test:trigger_event', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta.value?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value, undefined, TriggerTestMode.TRIGGER_EVENT)
    isListening.value = false

    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:trigger_event:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta.value?.category,
      })
    } else {
      localTestState.value = 'error'
      localErrorMessage.value = res?.error
    }
  } catch (er) {
    isListening.value = false
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er))?.message || 'Unknown error occurred'
    $e('a:workflow:node:test:trigger_event:error', {
      node_type: selectedNode.value?.type,
      node_category: nodeMeta.value?.category,
    })
  }
}

const copyWebhookUrl = () => {
  if (webhookUrl.value) {
    copy(webhookUrl.value)
    message.success('Webhook URL copied to clipboard')
  }
}

watch(selectedNode, () => {
  localTestState.value = 'idle'
  localErrorMessage.value = ''
  isListening.value = false
})
</script>

<template>
  <NcGroupedSettings title="Test Step">
    <div class="text-nc-content-gray-muted">
      <template v-if="supportsListenWebhook"> Send a request to the webhook URL to trigger this workflow. </template>
      <template v-else-if="supportsTriggerEvent">
        Listen for a real event from the external service to test this trigger.
      </template>
      <template v-else-if="isTriggerNode">
        Test this trigger to confirm its configuration is correct. The data from this test can be used in later steps.
      </template>
      <template v-else>
        Test this action to confirm it works as expected. This will use data from previous tested steps.
      </template>
    </div>

    <!-- Webhook URL (only for LISTEN_WEBHOOK triggers) -->
    <template v-if="supportsListenWebhook">
      <template v-if="webhookUrl">
        <div class="flex items-center gap-2 mt-2">
          <div
            class="flex-1 font-mono text-xs break-all select-all p-2 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight truncate"
          >
            {{ webhookUrl }}
          </div>
          <NcButton type="secondary" size="xs" @click="copyWebhookUrl()">
            <GeneralIcon icon="copy" class="w-4 h-4" />
          </NcButton>
        </div>
      </template>
      <template v-else>
        <div class="text-xs text-nc-content-gray-muted italic mt-2">Webhook URL will be generated when node is configured</div>
      </template>
    </template>

    <div class="w-full flex justify-end gap-2" :class="{ 'mt-3': supportsListenWebhook }">
      <NcTooltip v-if="supportsListenWebhook" placement="bottom" :disabled="testState !== 'error'">
        <NcButton
          type="secondary"
          size="small"
          :disabled="testState === 'testing' || testState === 'listening' || testState === 'listening_event'"
          :loading="testState === 'listening'"
          icon-position="right"
          @click="handleWebhookTest"
        >
          <template #icon>
            <GeneralIcon v-if="testState === 'success'" icon="circleCheckSolid" class="text-green-700 w-4 h-4 flex-none" />
            <GeneralIcon v-else-if="testState === 'error'" icon="alertTriangleSolid" class="text-red-700 w-4 h-4 flex-none" />
          </template>
          <span>{{
            testState === 'listening' ? 'Listening...' : testState === 'success' ? 'Webhook received' : 'Listen for webhook'
          }}</span>
        </NcButton>
        <template #title>{{ errorMessage }}</template>
      </NcTooltip>

      <NcTooltip
        v-if="supportsSampleData"
        placement="bottom"
        :disabled="
          !(
            (testState === 'error' && lastTestMode !== TriggerTestMode.TRIGGER_EVENT) ||
            (!canTestNode && untestedParentNodes.length > 0)
          )
        "
      >
        <NcButton
          type="secondary"
          size="small"
          :disabled="testState === 'testing' || testState === 'listening' || testState === 'listening_event' || !canTestNode"
          :loading="testState === 'testing'"
          icon-position="right"
          @click="handleTestNode"
        >
          <template #icon>
            <GeneralIcon
              v-if="testState === 'success' && lastTestMode !== TriggerTestMode.TRIGGER_EVENT"
              icon="circleCheckSolid"
              class="text-green-700 w-4 h-4 flex-none"
            />
            <GeneralIcon
              v-else-if="testState === 'error' && lastTestMode !== TriggerTestMode.TRIGGER_EVENT"
              icon="alertTriangleSolid"
              class="text-red-700 w-4 h-4 flex-none"
            />
          </template>
          <span>{{
            testState === 'testing'
              ? 'Testing...'
              : testState === 'success' && lastTestMode !== TriggerTestMode.TRIGGER_EVENT
              ? 'Test successful'
              : isNocoDBRecordTriggerNode
              ? 'Use suggested record to test'
              : isTriggerNode
              ? 'Test this trigger'
              : 'Test this action'
          }}</span>
        </NcButton>
        <template #title>
          <template v-if="testState === 'error' && lastTestMode !== TriggerTestMode.TRIGGER_EVENT">{{ errorMessage }}</template>
          <template v-else-if="!canTestNode && untestedParentNodes.length > 0">
            <div class="font-medium mb-1">Previous nodes need testing first:</div>
            <ul class="list-disc pl-5">
              <li v-for="nodeName in untestedParentNodes" :key="nodeName">{{ nodeName }}</li>
            </ul>
          </template>
        </template>
      </NcTooltip>

      <NcTooltip
        v-if="supportsTriggerEvent"
        placement="bottom"
        :disabled="!(testState === 'error' && lastTestMode === TriggerTestMode.TRIGGER_EVENT)"
      >
        <NcButton
          type="secondary"
          size="small"
          :disabled="testState === 'testing' || testState === 'listening' || testState === 'listening_event'"
          :loading="testState === 'listening_event'"
          icon-position="right"
          @click="handleTriggerEventTest"
        >
          <template #icon>
            <GeneralIcon
              v-if="testState === 'success' && lastTestMode === TriggerTestMode.TRIGGER_EVENT"
              icon="circleCheckSolid"
              class="text-green-700 w-4 h-4 flex-none"
            />
            <GeneralIcon
              v-else-if="testState === 'error' && lastTestMode === TriggerTestMode.TRIGGER_EVENT"
              icon="alertTriangleSolid"
              class="text-red-700 w-4 h-4 flex-none"
            />
          </template>
          <span>{{
            testState === 'listening_event'
              ? 'Listening...'
              : testState === 'success' && lastTestMode === TriggerTestMode.TRIGGER_EVENT
              ? 'Event received'
              : 'Listen for event'
          }}</span>
        </NcButton>
        <template #title>{{ errorMessage }}</template>
      </NcTooltip>
    </div>
  </NcGroupedSettings>
</template>

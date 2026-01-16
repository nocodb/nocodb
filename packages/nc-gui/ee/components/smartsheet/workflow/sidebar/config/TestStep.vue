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

const lastTestMode = computed(() => selectedNode.value?.data?.testResult?.testMode)

/**
 * Check if the node supports "Listen for webhook" testing
 * Only triggers with LISTEN_WEBHOOK in testModes should show the webhook URL UI
 * (e.g., core.trigger.webhook)
 */
const isListenWebhookTrigger = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.testModes?.includes(TriggerTestMode.LISTEN_WEBHOOK)
})

/**
 * Check if the node supports TRIGGER_EVENT testing (external integrations like GitHub)
 */
const isTriggerEventSupported = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.testModes?.includes(TriggerTestMode.TRIGGER_EVENT)
})

/**
 * Check if the node supports SAMPLE_DATA testing
 */
const isSampleDataSupported = computed(() => {
  const nodeMeta = getNodeMetaById(selectedNode.value?.type)
  return nodeMeta?.testModes?.includes(TriggerTestMode.SAMPLE_DATA)
})

/**
 * Check if the node supports both SAMPLE_DATA and TRIGGER_EVENT
 * This allows showing both test options to the user
 */
const supportsBothModes = computed(() => {
  return isSampleDataSupported.value && isTriggerEventSupported.value
})

const webhookUrl = computed(() => {
  if (!isListenWebhookTrigger.value || !selectedNode.value) return null

  const triggerId = selectedNode.value.data?.triggerId
  if (!triggerId) return null

  return `${appInfo.value?.ncSiteUrl}/api/v3/workflows/${activeWorkspaceId.value}/${activeProjectId.value}/${workflow.value?.id}/${triggerId}/webhook`
})

const isListening = ref(false)

const testState = computed(() => {
  if (localTestState.value) return localTestState.value
  if (selectedNode.value?.data?.testResult && selectedNode.value.data.testResult?.isStale !== true) {
    return selectedNode.value.data.testResult.status === 'success' ? 'success' : 'error'
  }
  return localTestState.value
})

const localErrorMessage = ref('')

const errorMessage = computed(() => {
  return selectedNode.value?.data?.testResult?.error || localErrorMessage.value
})

const untestedParentNodes = computed(() => {
  if (!selectedNode.value || !selectedNodeId.value) return []

  const ancestorIds = new Set(findAllParentNodes(selectedNodeId.value, edges.value))

  return nodes.value
    .filter((node) => {
      // Skip note nodes as they don't need to be tested
      if (node.type === GeneralNodeID.NOTE) return false
      return ancestorIds.has(node.id) && (!node.data?.testResult || node.data.testResult.status !== 'success')
    })
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

  // If no ancestors, can test
  if (ancestorIds.length === 0) {
    return true
  }

  // All ancestors must exist, have test results, be successful, and not stale
  return ancestorIds.every((ancestorId) => {
    const ancestorNode = nodes.value.find((n) => n.id === ancestorId)
    const testResult = ancestorNode?.data?.testResult

    return testResult?.status === 'success' && testResult.isStale !== true
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
    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta?.category,
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
      node_category: nodeMeta?.category,
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

  const nodeMeta = getNodeMetaById(selectedNode.value?.type)

  $e('a:workflow:node:test:webhook', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value)

    isListening.value = false

    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:webhook:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta?.category,
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
      node_category: nodeMeta?.category,
    })
  }
}

const copyWebhookUrl = () => {
  if (webhookUrl.value) {
    copy(webhookUrl.value)
    message.success('Webhook URL copied to clipboard')
  }
}

const handleSampleDataTest = async () => {
  localTestState.value = 'testing'
  localErrorMessage.value = ''

  const nodeMeta = getNodeMetaById(selectedNode.value?.type)

  $e('a:workflow:node:test:sample_data', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value, undefined, TriggerTestMode.SAMPLE_DATA)
    if (res?.status === 'success') {
      localTestState.value = 'success'
    } else {
      localTestState.value = 'error'
      localErrorMessage.value = res?.error
    }
  } catch (er) {
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er))?.message || 'Unknown error occurred'
  }
}

const handleTriggerEventTest = async () => {
  localTestState.value = 'listening_event'
  localErrorMessage.value = ''
  isListening.value = true

  const nodeMeta = getNodeMetaById(selectedNode.value?.type)

  $e('a:workflow:node:test:trigger_event', {
    node_type: selectedNode.value?.type,
    node_category: nodeMeta?.category,
  })

  try {
    const res = await testExecuteNode(selectedNodeId.value, undefined, TriggerTestMode.TRIGGER_EVENT)

    isListening.value = false

    if (res?.status === 'success') {
      localTestState.value = 'success'
      $e('a:workflow:node:test:trigger_event:success', {
        node_type: selectedNode.value?.type,
        node_category: nodeMeta?.category,
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
      node_category: nodeMeta?.category,
    })
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
    <template v-if="isListenWebhookTrigger">
      <div class="text-nc-content-gray-muted">Send a request to the webhook URL to trigger this workflow.</div>

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

      <div class="w-full flex justify-end mt-3">
        <NcTooltip placement="bottom" :disabled="testState !== 'error'">
          <NcButton
            type="secondary"
            size="small"
            :disabled="testState === 'listening'"
            :loading="testState === 'listening'"
            icon-position="right"
            @click="handleWebhookTest"
          >
            <template #icon>
              <GeneralIcon v-if="testState === 'success'" icon="circleCheckSolid" class="text-green-700 w-4 h-4 flex-none" />
              <GeneralIcon v-else-if="testState === 'error'" icon="alertTriangleSolid" class="text-red-700 w-4 h-4 flex-none" />
            </template>
            <span>
              <template v-if="testState === 'success'"> Webhook received </template>
              <template v-else-if="testState === 'listening'"> Listening... </template>
              <template v-else> Listen for webhook </template>
            </span>
          </NcButton>

          <template #title>
            <template v-if="testState === 'error'">
              {{ errorMessage }}
            </template>
          </template>
        </NcTooltip>
      </div>
    </template>
    <template v-else-if="supportsBothModes">
      <div class="text-nc-content-gray-muted">
        Test this trigger using sample data or listen for a real event from the external service.
      </div>

      <div class="w-full flex justify-end gap-2">
        <!-- Test with sample data button -->
        <NcTooltip placement="bottom" :disabled="!(testState === 'error' && lastTestMode === TriggerTestMode.SAMPLE_DATA)">
          <NcButton
            type="secondary"
            size="small"
            :disabled="testState === 'testing' || testState === 'listening_event'"
            :loading="testState === 'testing'"
            icon-position="right"
            @click="handleSampleDataTest"
          >
            <template #icon>
              <GeneralIcon
                v-if="testState === 'success' && lastTestMode === TriggerTestMode.SAMPLE_DATA"
                icon="circleCheckSolid"
                class="text-green-700 w-4 h-4 flex-none"
              />
              <GeneralIcon
                v-else-if="testState === 'error' && lastTestMode === TriggerTestMode.SAMPLE_DATA"
                icon="alertTriangleSolid"
                class="text-red-700 w-4 h-4 flex-none"
              />
            </template>
            <span>
              <template v-if="testState === 'success' && lastTestMode === TriggerTestMode.SAMPLE_DATA">
                Test successful
              </template>
              <template v-else> Test with sample data </template>
            </span>
          </NcButton>

          <template #title>
            <template v-if="testState === 'error' && lastTestMode === TriggerTestMode.SAMPLE_DATA">
              {{ errorMessage }}
            </template>
          </template>
        </NcTooltip>
        <NcTooltip placement="bottom" :disabled="!(testState === 'error' && lastTestMode === TriggerTestMode.TRIGGER_EVENT)">
          <NcButton
            type="secondary"
            size="small"
            :disabled="testState === 'testing' || testState === 'listening_event'"
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
            <span>
              <template v-if="testState === 'listening_event'"> Listening... </template>
              <template v-else-if="testState === 'success' && lastTestMode === TriggerTestMode.TRIGGER_EVENT">
                Event received
              </template>
              <template v-else> Listen for event </template>
            </span>
          </NcButton>

          <template #title>
            <template v-if="testState === 'error' && lastTestMode === TriggerTestMode.TRIGGER_EVENT">
              {{ errorMessage }}
            </template>
          </template>
        </NcTooltip>
      </div>
    </template>
    <template v-else>
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
            :disabled="!canTestNode || testState === 'testing'"
            :loading="testState === 'testing'"
            icon-position="right"
            @click="handleTestNode"
          >
            <template #icon>
              <GeneralIcon v-if="testState === 'success'" icon="circleCheckSolid" class="text-green-700 w-4 h-4 flex-none" />
              <GeneralIcon v-else-if="testState === 'error'" icon="alertTriangleSolid" class="text-red-700 w-4 h-4 flex-none" />
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
              <div class="font-medium mb-1">Previous nodes need testing first:</div>
              <ul v-if="untestedParentNodes.length > 0" class="list-disc pl-5">
                <li v-for="nodeName in untestedParentNodes" :key="nodeName">{{ nodeName }}</li>
              </ul>
            </template>
          </template>
        </NcTooltip>
      </div>
    </template>
  </NcGroupedSettings>
</template>

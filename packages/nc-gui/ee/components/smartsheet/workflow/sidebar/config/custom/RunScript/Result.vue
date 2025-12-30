<script setup lang="ts">
import { GeneralNodeID } from 'nocodb-sdk'
import dayjs from 'dayjs'
import VariableDisplay from '~/components/smartsheet/workflow/sidebar/config/VariableDisplay.vue'

const { getNodeMetaById, selectedNode, selectedNodeId, edges, nodes, testExecuteNode } = useWorkflowOrThrow()

const { $e } = useNuxtApp()

const localTestState = ref<'idle' | 'testing' | 'success' | 'error'>()

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
  if (!selectedNodeId.value) return

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
      localErrorMessage.value = res.error || 'Unknown error occurred'
    }
  } catch (er) {
    localTestState.value = 'error'
    localErrorMessage.value = (await extractSdkResponseErrorMsgv2(er as any))?.message || 'Unknown error occurred'
    $e('a:workflow:node:test:error', {
      node_type: selectedNode.value?.type,
      node_category: nodeMeta?.category,
    })
  }
}

const isInputExpanded = ref(true)
const isOutputExpanded = ref(true)

const isTestResultStale = computed(() => selectedNode.value?.data?.testResult?.isStale === true)

const testResult = computed(() => {
  return selectedNode.value?.data?.testResult
})

const inputVariables = computed(() => {
  return testResult.value?.inputVariables || []
})

const outputVariables = computed(() => {
  return testResult.value?.outputVariables || []
})

const inputData = computed(() => {
  return testResult.value?.input
})

const outputData = computed(() => {
  return testResult.value?.output
})

watch(selectedNode, () => {
  localTestState.value = 'idle'
  localErrorMessage.value = ''
})
</script>

<template>
  <div class="border-r-1 border-b-1 h-full flex flex-col">
    <div class="px-3 border-b-1 text-captionBold py-1 flex items-center justify-between">
      <div class="text-nc-content-gray-emphasis">Test output</div>

      <NcTooltip placement="bottom" :disabled="(canTestNode || untestedParentNodes.length === 0) && testState !== 'error'">
        <NcButton size="small" class="!h-7" :disabled="!canTestNode || testState === 'testing'" @click="handleTestNode">
          <div class="flex items-center gap-2">
            <template v-if="testState !== 'testing'">
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
              <GeneralIcon v-else icon="ncPlay" class="w-4 h-4" />
            </template>
            <template v-else>
              <GeneralLoader />
            </template>
            <span v-if="testState === 'success'">Test successful</span>
            <span v-else>Test</span>
          </div>
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

    <div class="flex-1 overflow-auto p-3">
      <div v-if="testResult" class="space-y-3">
        <NcAlert v-if="isTestResultStale" type="warning">
          <template #message> Stale results </template>
          <template #description> The results may be out of date. Please test this step again. </template>
        </NcAlert>

        <div class="space-y-1">
          <div v-if="testResult.status === 'success'" class="text-bodyBold text-nc-content-green-dark">Step successful</div>
          <div v-else-if="testResult.status === 'error'" class="text-bodyBold text-nc-content-red-dark">Step failed</div>
          <div class="text-bodySm text-nc-content-gray-subtle">
            Step run {{ dayjs(testResult.endTime || testResult.startTime).fromNow() }}
          </div>
          <div v-if="testResult.startTime && testResult.endTime" class="text-bodySm text-nc-content-gray-subtle">
            Duration: {{ ((testResult.endTime - testResult.startTime) / 1000).toFixed(2) }}s
          </div>
        </div>

        <!-- Error Message -->
        <NcAlert v-if="testResult.status === 'error' && testResult.error" type="error">
          <template #message> Error </template>
          <template #description>
            {{ testResult.error }}
          </template>
        </NcAlert>

        <!-- Input Section -->
        <div
          v-if="inputVariables.length > 0"
          class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden"
        >
          <div
            :class="{
              'border-b-1 border-nc-border-gray-extralight hover:border-nc-border-gray-medium': isInputExpanded,
            }"
            class="flex items-center py-1 px-3 justify-between hover:bg-nc-bg-gray-extralight"
            @click="isInputExpanded = !isInputExpanded"
          >
            <div class="text-captionBold text-nc-content-gray-emphasis">Input</div>

            <NcButton type="text" size="xxsmall">
              <GeneralIcon
                icon="ncChevronRight"
                class="transition-all transform"
                :class="{
                  'rotate-90': isInputExpanded,
                }"
              />
            </NcButton>
          </div>

          <div v-if="isInputExpanded">
            <VariableDisplay :variables="inputVariables" :data="inputData" />
          </div>
        </div>

        <!-- Output Section -->
        <div
          v-if="outputVariables.length > 0"
          class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden"
        >
          <div
            :class="{
              'border-b-1 border-nc-border-gray-extralight hover:border-nc-border-gray-medium': isOutputExpanded,
            }"
            class="flex items-center py-1 px-3 justify-between hover:bg-nc-bg-gray-extralight"
            @click="isOutputExpanded = !isOutputExpanded"
          >
            <div class="flex items-center gap-2">
              <div class="text-captionBold text-nc-content-gray-emphasis">Output</div>
            </div>

            <NcButton type="text" size="xxsmall">
              <GeneralIcon
                icon="ncChevronRight"
                class="transition-all transform"
                :class="{
                  'rotate-90': isOutputExpanded,
                }"
              />
            </NcButton>
          </div>

          <div v-if="isOutputExpanded">
            <VariableDisplay :variables="outputVariables" :data="outputData" />
          </div>
        </div>

        <!-- Logs/Console Section -->
        <div v-if="testResult.logs && testResult.logs.length > 0" class="space-y-2">
          <div class="text-captionBold text-nc-content-gray-emphasis">Console</div>
          <div class="bg-nc-bg-gray-extralight rounded-md p-2 space-y-1 max-h-60 overflow-auto">
            <div
              v-for="(log, index) in testResult.logs"
              :key="index"
              class="text-bodySm font-mono"
              :class="{
                'text-nc-content-gray-emphasis': log.level === 'info',
                'text-nc-content-orange-dark': log.level === 'warn',
                'text-nc-content-red-dark': log.level === 'error',
              }"
            >
              [{{ log.level }}] {{ log.message }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="flex items-center justify-center h-full">
        <div class="text-nc-content-gray-muted text-bodySm">Run a test to see the output</div>
      </div>
    </div>
  </div>
</template>

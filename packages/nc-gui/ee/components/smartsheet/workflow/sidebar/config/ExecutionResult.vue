<script setup lang="ts">
import dayjs from 'dayjs'
import VariableDisplay from './VariableDisplay.vue'

const { viewingExecution, getNodeMetaById, selectedNode } = useWorkflowOrThrow()

const isInputExpanded = ref(true)

const isOutputExpanded = ref(true)

const executionResult = computed(() => {
  if (!viewingExecution.value || !selectedNode.value) return null

  const executionData = viewingExecution.value.execution_data
  if (!executionData || !executionData.nodeResults) return null

  // Find the node result by nodeId
  return (executionData.nodeResults || []).find((result: any) => result.nodeId === selectedNode.value?.id) || null
})

const nodeMeta = computed(() => {
  if (!executionResult.value) return null
  return getNodeMetaById(executionResult.value.nodeId)
})

const inputVariables = computed(() => {
  return executionResult.value?.inputVariables || []
})

const outputVariables = computed(() => {
  return executionResult.value?.outputVariables || []
})

const inputData = computed(() => {
  return executionResult.value?.input
})

const outputData = computed(() => {
  return executionResult.value?.output
})
</script>

<template>
  <NcGroupedSettings title="Execution Result">
    <div v-if="executionResult" class="space-y-3">
      <div class="space-y-1">
        <div v-if="executionResult.status === 'success'" class="text-bodyBold text-nc-content-green-dark">
          Node executed successfully
        </div>
        <div v-else-if="executionResult.status === 'error'" class="text-bodyBold text-nc-content-red-dark">Node failed</div>
        <div class="text-bodySm text-nc-content-gray-subtle">
          Executed {{ dayjs(executionResult.endTime || executionResult.startTime).fromNow() }}
        </div>
        <div v-if="executionResult.startTime && executionResult.endTime" class="text-bodySm text-nc-content-gray-subtle">
          Duration: {{ ((executionResult.endTime - executionResult.startTime) / 1000).toFixed(2) }}s
        </div>
      </div>

      <!-- Error Message -->
      <NcAlert v-if="executionResult.status === 'error' && executionResult.error" type="error">
        <template #message> Error </template>
        <template #description>
          {{ executionResult.error }}
        </template>
      </NcAlert>

      <div v-if="inputData" class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden">
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

      <div v-if="outputData" class="border-1 border-nc-border-gray-medium rounded-md cursor-pointer overflow-hidden">
        <div
          :class="{
            'border-b-1 border-nc-border-gray-extralight hover:border-nc-border-gray-medium': isOutputExpanded,
          }"
          class="flex items-center py-1 px-3 justify-between hover:bg-nc-bg-gray-extralight"
          @click="isOutputExpanded = !isOutputExpanded"
        >
          <div class="flex items-center gap-2">
            <GeneralIcon v-if="nodeMeta" :icon="nodeMeta.icon" />

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

      <!-- Logs Section -->
      <div v-if="executionResult.logs && executionResult.logs.length > 0" class="space-y-2">
        <div class="text-captionBold text-nc-content-gray-emphasis">Logs</div>
        <div class="bg-nc-bg-gray-extralight rounded-md p-2 space-y-1 max-h-60 overflow-auto">
          <div
            v-for="(log, index) in executionResult.logs"
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
    <div v-else>
      <div class="flex items-center">
        <div class="text-nc-content-gray-muted text-bodySm">Node has not been executed</div>
      </div>
    </div>
  </NcGroupedSettings>
</template>

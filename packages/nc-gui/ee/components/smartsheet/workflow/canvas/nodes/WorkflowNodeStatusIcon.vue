<script setup lang="ts">
const props = defineProps({
  nodeId: {
    type: String,
    default: null,
  },
})

const { viewingExecution, nodes } = useWorkflowOrThrow()
const { getNodeResultAtCurrentIteration } = useWorkflowExecutionLoop()

const executionResult = computed(() => {
  if (!viewingExecution.value?.execution_data) return null

  // Use helper to find result in nested structure or main nodeResults
  return getNodeResultAtCurrentIteration(props.nodeId, viewingExecution.value.execution_data)
})

const testResult = computed(() => {
  return nodes.value.find((node) => node.id === props.nodeId)?.data?.testResult
})

const isTestMode = computed(() => !viewingExecution.value)

const status = computed(() => {
  const result = isTestMode.value ? testResult.value : executionResult.value
  return result?.status || null
})

const STATUS_CONFIG = {
  success: {
    icon: 'ncCheck',
    testLabel: 'Tested successfully',
    executionLabel: 'Executed successfully',
  },
  error: {
    icon: 'alertTriangle',
    testLabel: 'Test failed',
    executionLabel: 'Execution failed',
  },
  running: {
    icon: 'refresh',
    testLabel: '',
    executionLabel: 'Running',
  },
  skipped: {
    icon: 'ncMinus',
    testLabel: '',
    executionLabel: 'Skipped',
  },
  pending: {
    icon: 'ncPending',
    testLabel: '',
    executionLabel: 'Pending',
  },
} as const

const statusConfig = computed(() => STATUS_CONFIG[status.value as keyof typeof STATUS_CONFIG])

const tooltip = computed(() => {
  if (!statusConfig.value) return ''
  return isTestMode.value ? statusConfig.value.testLabel : statusConfig.value.executionLabel
})
</script>

<template>
  <div v-if="status" class="absolute -top-2 -right-2">
    <NcTooltip>
      <template #title>
        {{ tooltip }}
      </template>

      <div
        :class="{
          'bg-nc-green-700 dark:bg-nc-green-200': status === 'success',
          'bg-nc-red-500 dark:bg-nc-red-500': status === 'error',
          'bg-nc-brand-500 dark:bg-nc-brand-500': status === 'running',
          'bg-nc-gray-400 dark:bg-nc-gray-500': status === 'skipped' || status === 'pending',
        }"
        class="w-5 h-5 rounded-full flex items-center justify-center"
      >
        <GeneralIcon :icon="statusConfig?.icon" class="text-base-white !w-3 !h-3" />
      </div>
    </NcTooltip>
  </div>
</template>

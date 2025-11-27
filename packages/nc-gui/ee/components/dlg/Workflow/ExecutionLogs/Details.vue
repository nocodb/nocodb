<script setup lang="ts">
import dayjs from 'dayjs'

interface Props {
  item: any
}

const props = defineProps<Props>()

const formatDate = (date: string) => {
  return dayjs(date).format('MMM DD, YYYY HH:mm:ss')
}

const formatDuration = (startedAt: string, finishedAt?: string) => {
  if (!finishedAt) return '-'
  const start = dayjs(startedAt)
  const end = dayjs(finishedAt)
  const duration = end.diff(start, 'millisecond')
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`
  return `${(duration / 60000).toFixed(2)}m`
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'success':
      return 'Success'
    case 'error':
      return 'Error'
    case 'in_progress':
      return 'In Progress'
    default:
      return status
  }
}

const parsedWorkflowData = computed(() => {
  try {
    return props.item?.workflow_data || {}
  } catch {
    return {}
  }
})

const parsedExecutionData = computed(() => {
  try {
    return props.item?.execution_data || {}
  } catch {
    return {}
  }
})

const executionDataCopyContent = computed(() => {
  return JSON.stringify(parsedExecutionData.value, null, 2)
})

const workflowDataCopyContent = computed(() => {
  return JSON.stringify(parsedWorkflowData.value, null, 2)
})
</script>

<template>
  <div class="container">
    <template v-if="item">
      <div class="log-details">
        <div class="log-detail-item">
          <span class="label">Status</span>
          <span class="value">{{ getStatusLabel(item.status) }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Started At</span>
          <span class="value">{{ formatDate(item.started_at) }}</span>
        </div>
        <div v-if="item.finished_at" class="log-detail-item">
          <span class="label">Finished At</span>
          <span class="value">{{ formatDate(item.finished_at) }}</span>
        </div>
        <div v-if="item.finished_at" class="log-detail-item">
          <span class="label">Duration</span>
          <span class="value">{{ formatDuration(item.started_at, item.finished_at) }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Execution ID</span>
          <span class="value">{{ item.id }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Workflow ID</span>
          <span class="value">{{ item.fk_workflow_id }}</span>
        </div>
        <div v-if="parsedWorkflowData.title" class="log-detail-item">
          <span class="label">Workflow Title</span>
          <span class="value">{{ parsedWorkflowData.title }}</span>
        </div>
        <div v-if="parsedWorkflowData.nodes" class="log-detail-item">
          <span class="label">Total Nodes</span>
          <span class="value">{{ parsedWorkflowData.nodes?.length || 0 }}</span>
        </div>
      </div>

      <div class="request-response-wrapper">
        <div class="request-wrapper">
          <DlgWorkflowExecutionLogsDataCard
            title="Workflow Snapshot"
            :data="parsedWorkflowData"
            :copy-content="workflowDataCopyContent"
          />
        </div>
        <div class="response-wrapper">
          <DlgWorkflowExecutionLogsDataCard
            title="Execution Data"
            :data="parsedExecutionData"
            :copy-content="executionDataCopyContent"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-6 h-full w-full overflow-auto nc-scrollbar-thin flex-col flex gap-6;

  .log-details {
    @apply grid grid-cols-2 gap-2;

    .log-detail-item {
      @apply flex flex-row;
      .label {
        @apply w-30 font-bold text-small1 text-nc-content-gray-emphasis;
      }

      .value {
        @apply text-nc-content-gray-subtle2 font-500 text-small1;
      }
    }
  }

  .request-response-wrapper {
    @apply flex-1 flex flex-row gap-3.5 w-full items-stretch;
    .request-wrapper,
    .response-wrapper {
      @apply flex flex-col flex-1 gap-2 min-w-10 flex-1 min-w-10;
    }
  }
}
</style>

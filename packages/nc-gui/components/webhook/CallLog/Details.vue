<script setup lang="ts">
import type { HookLogType } from 'nocodb-sdk'
import { hookLogFormatter } from '../../../utils/datetimeUtils'

interface Props {
  item: HookLogType
}

const props = defineProps<Props>()

const parsedPayload = computed(() => {
  try {
    return (typeof props.item.payload === 'object' ? props.item.payload : JSON.stringify(props.item.payload, null, 2)) || {}
  } catch {
    return {}
  }
})
const parsedRespondePayload = computed(() => {
  try {
    return (typeof props.item.response === 'object' ? props.item.response : JSON.stringify(props.item.response, null, 2)) || {}
  } catch {
    return {}
  }
})

const hookType = (item: HookLogType) => {
  if (item.operation === 'update') {
    return 'On Record Update'
  } else if (item.operation === 'insert') {
    return 'On Record Insert'
  } else if (item.operation === 'delete') {
    return 'On Record Delete'
  } else if (item.operation === 'bulkDelete' || item.operation === 'bulkDeleteAll') {
    return 'On Bulk Record Delete'
  } else if (item.operation === 'bulkInsert') {
    return 'On Bulk Record Insert'
  } else if (item.operation === 'bulkUpdate' || item.operation === 'bulkUpdateAll') {
    return 'On Bulk Record Update'
  }

  return 'On Record Insert'
}
</script>

<template>
  <div class="container">
    <template v-if="item">
      <div v-if="parsedPayload.method && parsedPayload.url" class="log-url-wrapper">
        <div class="log-method">{{ parsedPayload.method }}</div>
        <div class="log-url">{{ parsedPayload.url }}</div>
      </div>

      <div class="log-details">
        <div class="log-detail-item">
          <span class="label">Execution Time</span>
          <span class="value">{{ item.execution_time }} ms</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Webhook Type</span>
          <span class="value">{{ hookType(item) }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Request Time</span>
          <span class="value">{{ hookLogFormatter(item.created_at) }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">ID</span>
          <span class="value">{{ item.id }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Triggered By</span>
          <span class="value">{{ item.triggered_by }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Test call</span>
          <span class="value">{{ !!item.test_call }}</span>
        </div>
        <div v-if="item.error_code" class="log-detail-item">
          <span class="label">Error code</span>
          <span class="value">{{ item.error_code }}</span>
        </div>
        <div v-if="item.error_message" class="log-detail-item">
          <span class="label">Error message</span>
          <span class="value">{{ item.error_message }}</span>
        </div>
      </div>

      <div class="request-response-wrapper">
        <div class="request-wrapper">
          <WebhookCallLogReqResDetailCard
            title="Request"
            :headers="parsedPayload.headers"
            :payload="parsedPayload.data"
            :params="parsedPayload.params"
          />
        </div>
        <div class="response-wrapper">
          <WebhookCallLogReqResDetailCard
            title="Response"
            :headers="parsedRespondePayload.headers"
            :payload="parsedRespondePayload.data"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-6 h-full overflow-auto flex-col flex gap-6;
  .log-details {
    @apply grid grid-cols-2 gap-2;

    .log-detail-item {
      @apply flex flex-row;
      .label {
        @apply w-30 font-bold  text-small1;
      }

      .value {
        @apply text-gray-500  text-small1;
      }
    }
  }

  .request-response-wrapper {
    @apply flex flex-row gap-3.5 w-full items-stretch;
    .request-wrapper,
    .response-wrapper {
      @apply flex flex-col flex-1 gap-2 min-w-10 flex-1 min-w-10;
    }
  }

  .log-url-wrapper {
    @apply flex flex-row gap-2 items-center h-20px;
    .log-method {
      @apply bg-gray-200 rounded-md leading-20px px-1 text-gray-600;
    }

    .log-url {
      @apply text-small1 text-primary font-weight-default;
    }
  }
}
</style>

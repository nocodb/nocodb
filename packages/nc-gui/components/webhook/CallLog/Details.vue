<script setup lang="ts">
import type { HookLogType } from 'nocodb-sdk'
import {hookLogFormatter} from "../../../utils/datetimeUtils";

interface Props {
  item: HookLogType
}

const props = defineProps<Props>()

const parsedPayload = computed(() => {
  try {
    return typeof props.item.payload === 'object' ? props.item.payload : JSON.stringify(props.item.payload, null, 2)
  } catch {
    return {}
  }
})
const parsedRespondePayload = computed(() => {
  try {
    return typeof props.item.response === 'object' ? props.item.response : JSON.stringify(props.item.response, null, 2)
  } catch {
    return {}
  }
})
</script>

<template>
  <div class="container">
    <template v-if="item">
      <div class="font-weight-bold">{{ hookLogFormatter(item.created_at) }}</div>

      <div class="flex items-start gap-3 bg-green-50 rounded-md w-full p-4">
        <GeneralIcon icon="checkFill" class="text-white w-4 h-4 mt-0.75" />
        <div>{{ item.error ? 'Failed' : 'Succeded' }} in {{ item.execution_time }} ms</div>
      </div>

      <div class="log-details">
        <div class="log-detail-item">
          <span class="label">Request Time</span>
          <span class="value">{{ hookLogFormatter(item.created_at) }}</span>
        </div>
        <div class="log-detail-item">
          <span class="label">Size</span>
          <span class="value">{{ item.size }}</span>
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
          <span class="value">{{ item.test_call }}</span>
        </div>
      </div>

      <div class="request-response-wrapper">
        <div class="request-wrapper">
          <WebhookCallLogReqResDetailCard title="Request" :headers="parsedPayload.headers" :payload="parsedPayload.data" />
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
    @apply flex flex-col gap-2;

    .log-detail-item {
      @apply flex flex-row;
      .label {
        @apply w-30 font-bold;
      }

      .value {
        @apply text-gray-500;
      }
    }

    .headers {
      @apply flex flex-row;
      .label {
        @apply w-30 font-bold;
      }

      .value {
        @apply text-gray-500;
      }
    }
  }

  .request-response-wrapper {
    @apply flex flex-row gap-2 w-full;
    .request-wrapper,
    .response-wrapper {
      @apply flex flex-col flex-1 gap-2 min-w-10 flex-1 min-w-10;
    }
  }
}
</style>

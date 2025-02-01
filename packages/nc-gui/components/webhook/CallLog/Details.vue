<script setup lang="ts">
import type { HookLogType } from 'nocodb-sdk'

interface Props {
  item: HookLogType
}

defineProps<Props>()
</script>

<template>
  <div class="container">
    <template v-if="item">
      <pre>{{item}}</pre>
      <div class="font-weight-bold">{{ item.created_at }}</div>

      <a-alert class="mt-2 mb-3" type="success" show-icon>
        <template #message>
          <div class="flex flex-row justify-between items-center py-1">
            <div>Succeeded in {{ item.execution_time }} ms</div>
            <div>
              <GeneralIcon v-if="item.error" icon="checkFill" class=""></GeneralIcon>
              <GeneralIcon v-else icon="checkFill" class=""></GeneralIcon>
            </div>
          </div>
        </template>
      </a-alert>

      <div class="log-details">
        <div class="log-detail-item">
          <span class="label">Request Time</span>
          <span class="value">{{ item.created_at }}</span>
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
          <div class="request-response-title">Request</div>
          <div class="headers">
            <div class="log-detail-item">
              <span class="label">Request Time</span>
              <span class="value">{{ item.created_at }}</span>
            </div>
          </div>
          <h4>Payload</h4>
          <LazyMonacoEditor
            :model-value="item.payload"
            class="min-w-full w-full h-50 resize overflow-auto expanded-editor"
            hide-minimap
            disable-deep-compare
            read-only
            :monaco-config="{
              lineNumbers: 'on',
            }"
            @keydown.enter.stop
            @keydown.alt.stop
          />
        </div>
        <div class="response-wrapper">
          <div class="request-response-title">Response</div>
          <h4>Payload</h4>
          <LazyMonacoEditor
            :model-value="item.response"
            class="min-w-full w-full h-50 resize overflow-auto expanded-editor"
            hide-minimap
            disable-deep-compare
            read-only
            :monaco-config="{
              lineNumbers: 'on',
            }"
            @keydown.enter.stop
            @keydown.alt.stop
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-2 h-full overflow-auto;
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
      @apply flex flex-col gap-2 min-w-10 flex-1;
    }
  }
}
</style>

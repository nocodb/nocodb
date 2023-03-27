<script setup lang="ts">
import type { HookLogType, HookType } from 'nocodb-sdk'
import { onBeforeMount, parseProp, timeAgo, useApi } from '#imports'

const props = defineProps<Props>()

const { api, isLoading } = useApi()

const hookLogs = ref<HookLogType[]>([])

const activeKey = ref()

interface Props {
  hook: HookType
}

async function loadHookLogList() {
  hookLogs.value = (await api.dbTableWebhookLogs.list(props.hook.id!)).list!
}

onBeforeMount(async () => {
  await loadHookLogList()
})
</script>

<template>
  <a-skeleton v-if="isLoading" />
  <a-empty v-else-if="!hookLogs.length" />
  <a-collapse v-else v-model:activeKey="activeKey" class="nc-hook-log-collapse">
    <a-collapse-panel v-for="(hookLog, idx) of hookLogs" :key="idx">
      <template #header>
        <div class="w-full cursor-pointer">
          <div class="font-weight-medium flex">
            <div class="flex-1">
              {{ hookLog.type }}: records.{{ hookLog.event }}.{{ hookLog.operation }} ({{ timeAgo(hookLog.created_at) }})
            </div>
            <div
              v-if="hookLog.type === 'URL'"
              class="mx-1 px-2 py-1 text-white rounded bg-red-500 text-xs"
              :class="{ '!bg-green-500': parseProp(hookLog.response).status === 200 }"
            >
              {{ parseProp(hookLog.response).status }}
              {{ parseProp(hookLog.response).statusText }}
            </div>
            <div v-if="hookLog.type === 'Email'">
              <div v-if="hookLog.error_message" class="mx-1 px-2 py-1 text-white rounded text-xs bg-red-500">ERROR</div>
              <div v-else class="mx-1 px-2 py-1 text-white rounded text-xs bg-green-500">OK</div>
            </div>
          </div>
          <div v-if="hookLog.type === 'URL'">
            <span class="font-weight-medium text-primary">
              {{ parseProp(hookLog.payload).method }}
            </span>
            {{ parseProp(hookLog.payload).path }}
          </div>
        </div>
      </template>

      <div v-if="hookLog.type === 'URL'">
        <div class="nc-hook-log-request">
          <div class="nc-hook-pre-title">Request</div>
          <pre class="nc-hook-pre">{{ parseProp(hookLog.response).config.headers }}</pre>
        </div>

        <div class="nc-hook-log-response">
          <div class="nc-hook-pre-title">Response</div>
          <pre class="nc-hook-pre">{{ parseProp(hookLog.response).headers }}</pre>
        </div>

        <div class="nc-hook-log-payload">
          <div class="nc-hook-pre-title">Payload</div>
          <pre class="nc-hook-pre">{{ parseProp(parseProp(hookLog.response).config.data) }}</pre>
        </div>
      </div>

      <div v-else-if="hookLog.type === 'Email'">
        <div v-if="hookLog.error_message" class="mb-4">
          {{ hookLog.error_message }}
        </div>
        <div class="nc-hook-log-payload">
          <div class="nc-hook-pre-title">Payload</div>
          <pre class="nc-hook-pre">{{ parseProp(hookLog.payload) }}</pre>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss">
.nc-hook-log-collapse {
  .nc-hook-pre-title {
    @apply font-bold mb-2;
  }
  .nc-hook-pre {
    @apply bg-gray-100;
    padding: 10px;
  }
}
</style>

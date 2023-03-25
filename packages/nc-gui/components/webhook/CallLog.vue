<script setup lang="ts">
import type { HookLogType, HookType } from 'nocodb-sdk'
import { onBeforeMount, parseProp, timeAgo, useApi } from '#imports'

const props = defineProps<Props>()

const { api } = useApi()

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
  <a-collapse v-model:activeKey="activeKey" class="nc-hook-log-collapse">
    <a-collapse-panel v-for="(hookLog, idx) of hookLogs" :key="idx">
      <template #header>
        <div class="w-full cursor-pointer">
          <div class="font-weight-medium flex">
            <div class="flex-1">records.{{ hookLog.event }}.{{ hookLog.operation }} ({{ timeAgo(hookLog.created_at) }})</div>
            <div
              class="mx-1 px-2 py-1 text-white rounded bg-red-500"
              :class="{ '!bg-green-500': parseProp(hookLog.response).status === 200 }"
            >
              {{ parseProp(hookLog.response).status }}
              {{ parseProp(hookLog.response).statusText }}
            </div>
          </div>
          <div>
            <span class="font-weight-medium text-primary">
              {{ parseProp(hookLog.payload).method }}
            </span>
            {{ parseProp(hookLog.payload).path }}
          </div>
        </div>
      </template>

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
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss">
.nc-hook-log-collapse {
  .nc-hook-pre-title {
    @apply font-weight-medium mb-2;
  }
  .nc-hook-pre {
    @apply bg-gray-100;
    padding: 10px;
  }
}
</style>

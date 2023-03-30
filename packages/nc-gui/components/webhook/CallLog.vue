<script setup lang="ts">
import type { HookLogType, HookType } from 'nocodb-sdk'
import { extractSdkResponseErrorMsg, onBeforeMount, parseProp, timeAgo, useApi, useGlobal } from '#imports'

interface Props {
  hook: HookType
}

const props = defineProps<Props>()

const { api, isLoading } = useApi()

const hookLogs = ref<HookLogType[]>([])

const activeKey = ref()

const { appInfo } = useGlobal()

let totalRows = $ref(0)

const currentPage = $ref(1)

const currentLimit = $ref(10)

const showLogs = computed(
  () => !(appInfo.value.automationLogLevel === 'OFF' || (appInfo.value.automationLogLevel === 'ALL' && !appInfo.value.ee)),
)

async function loadHookLogs(page = currentPage, limit = currentLimit) {
  try {
    // cater empty records
    page = page || 1
    const { list, pageInfo } = await api.dbTableWebhookLogs.list(props.hook.id!, {
      offset: limit * (page - 1),
      limit,
    })
    hookLogs.value = list
    totalRows = pageInfo.totalRows ?? 0
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onBeforeMount(async () => {
  if (showLogs.value) {
    await loadHookLogs(currentPage, currentLimit)
  }
})
</script>

<template>
  <a-skeleton v-if="isLoading" />
  <div v-else>
    <a-card class="!mb-[20px]" :body-style="{ padding: '10px' }">
      <span v-if="appInfo.automationLogLevel === 'OFF'">
        The NC_AUTOMATION_LOG_LEVEL is set to “OFF”, no logs will be displayed.
      </span>
      <span v-if="appInfo.automationLogLevel === 'ERROR'">
        The NC_AUTOMATION_LOG_LEVEL is set to “ERROR”, only error logs will be displayed.
      </span>
      <span v-if="appInfo.automationLogLevel === 'ALL'">
        <span v-if="appInfo.ee">
          The NC_AUTOMATION_LOG_LEVEL is set to “ALL”, both error and success logs will be displayed.
        </span>
        <span v-else> Upgrade to Enterprise Edition to show all the logs. </span>
      </span>
      <span>
        For additional configuration options, please refer the documentation
        <a href="https://docs.nocodb.com/developer-resources/webhooks#call-log" target="_blank">here</a>.
      </span>
    </a-card>

    <div v-if="showLogs">
      <a-empty v-if="!hookLogs.length" />
      <a-layout v-else>
        <a-layout-content>
          <a-collapse v-model:activeKey="activeKey" class="nc-hook-log-collapse">
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
        </a-layout-content>
        <a-layout-footer class="!bg-white text-center">
          <a-pagination
            v-model:current="currentPage"
            :page-size="currentLimit"
            :total="totalRows"
            show-less-items
            @change="loadHookLogs"
          />
        </a-layout-footer>
      </a-layout>
    </div>
  </div>
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

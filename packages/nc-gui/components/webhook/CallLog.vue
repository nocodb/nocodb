<script setup lang="ts">
import type { HookLogType, HookType } from 'nocodb-sdk'
import { AutomationLogLevel, extractSdkResponseErrorMsg, onBeforeMount, parseProp, timeAgo, useApi, useGlobal } from '#imports'

interface Props {
  hook: HookType
}

const props = defineProps<Props>()

const { api, isLoading } = useApi()

const hookLogs = ref<HookLogType[]>([])

const activeKey = ref()

const { appInfo } = useGlobal()

const totalRows = ref(0)

const currentPage = ref(1)

const currentLimit = ref(10)

const showLogs = computed(
  () =>
    !(
      appInfo.value.automationLogLevel === AutomationLogLevel.OFF ||
      (appInfo.value.automationLogLevel === AutomationLogLevel.ALL && !appInfo.value.ee)
    ),
)

async function loadHookLogs(page = currentPage.value, limit = currentLimit.value) {
  try {
    // cater empty records
    page = page || 1
    const { list, pageInfo } = await api.dbTableWebhookLogs.list(props.hook.id!, {
      offset: limit * (page - 1),
      limit,
    })
    hookLogs.value = parseHookLog(list)
    totalRows.value = pageInfo.totalRows ?? 0
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function parseHookLog(hookLogs: any) {
  for (const hookLog of hookLogs) {
    if (hookLog?.response) {
      hookLog.response = parseProp(hookLog.response)
    }
    if (hookLog?.response?.config?.data) {
      hookLog.response.config.data = parseProp(hookLog.response.config.data)
    }
    if (hookLog?.payload) {
      hookLog.payload = parseProp(hookLog.payload)
    }
    if (hookLog?.notification) {
      hookLog.notification = parseProp(hookLog.notification)
    }
  }
  return hookLogs
}

onBeforeMount(async () => {
  if (showLogs.value) {
    await loadHookLogs(currentPage.value, currentLimit.value)
  }
})
</script>

<template>
  <a-skeleton v-if="isLoading" />
  <div v-else>
    <a-card class="!mb-[20px]" :body-style="{ padding: '10px' }">
      <span v-if="appInfo.automationLogLevel === AutomationLogLevel.OFF">
        The NC_AUTOMATION_LOG_LEVEL is set to “OFF”, no logs will be displayed.
      </span>
      <span v-if="appInfo.automationLogLevel === AutomationLogLevel.ERROR">
        The NC_AUTOMATION_LOG_LEVEL is set to “ERROR”, only error logs will be displayed.
      </span>
      <span v-if="appInfo.automationLogLevel === AutomationLogLevel.ALL">
        <span v-if="appInfo.ee">
          The NC_AUTOMATION_LOG_LEVEL is set to “ALL”, both error and success logs will be displayed.
        </span>
        <span v-else> Upgrade to Enterprise Edition to show all the logs. </span>
      </span>
      <span>
        For additional configuration options, please refer the documentation
        <a href="https://docs.nocodb.com/developer-resources/webhooks#call-log" target="_blank" rel="noopener">here</a>.
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

                    <div v-if="hookLog.type === 'Email'">
                      <div v-if="hookLog.error_message" class="mx-1 px-2 py-1 text-white rounded text-xs bg-red-500">ERROR</div>
                      <div v-else class="mx-1 px-2 py-1 text-white rounded text-xs bg-green-500">OK</div>
                    </div>
                    <div
                      v-else
                      class="mx-1 px-2 py-1 text-white rounded bg-red-500 text-xs"
                      :class="{ '!bg-green-500': hookLog.response?.status === 200 }"
                    >
                      {{ hookLog.response?.status }}
                      {{ hookLog.response?.statusText || (hookLog.response?.status === 200 ? 'OK' : 'ERROR') }}
                    </div>
                  </div>
                  <div v-if="hookLog.type === 'URL'">
                    <span class="font-weight-medium text-primary">
                      {{ hookLog.payload.method }}
                    </span>
                    {{ hookLog.payload.path }}
                  </div>
                </div>
              </template>

              <div v-if="hookLog.error_message" class="mb-4">
                {{ hookLog.error_message }}
              </div>

              <div v-if="hookLog.type !== 'Email'">
                <div v-if="hookLog?.response?.config?.headers" class="nc-hook-log-request">
                  <div class="nc-hook-pre-title">Request</div>
                  <pre class="nc-hook-pre">{{ hookLog.response.config.headers }}</pre>
                </div>

                <div v-if="hookLog?.response?.headers" class="nc-hook-log-response">
                  <div class="nc-hook-pre-title">Response</div>
                  <pre class="nc-hook-pre">{{ hookLog.response.headers }}</pre>
                </div>

                <div v-if="hookLog?.response?.config?.data" class="nc-hook-log-payload">
                  <div class="nc-hook-pre-title">Payload</div>
                  <pre class="nc-hook-pre">{{ hookLog.response.config.data }}</pre>
                </div>
              </div>
              <div v-else>
                <div v-if="hookLog?.payload" class="nc-hook-log-payload">
                  <div class="nc-hook-pre-title">Payload</div>
                  <pre class="nc-hook-pre">{{ hookLog.payload }}</pre>
                </div>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </a-layout-content>
        <a-layout-footer class="!bg-white text-center">
          <a-pagination
            v-model:current="currentPage"
            v-model:page-size="currentLimit"
            :total="+totalRows"
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

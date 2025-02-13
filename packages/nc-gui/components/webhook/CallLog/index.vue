<script setup lang="ts">
import type { HookLogType, HookType, PaginatedType } from 'nocodb-sdk'

interface Props {
  hook: HookType
}

const props = defineProps<Props>()

const { api, isLoading } = useApi()

const hookLogs = ref<HookLogType[]>([])

const { appInfo } = useGlobal()

const logPaginationData = ref<PaginatedType>({ page: 1, pageSize: 10, totalRows: 0 })

const _activeItem = ref<HookLogType>()
const activeItem = computed<HookLogType>({
  get: () => {
    if (_activeItem.value) {
      return _activeItem.value
    }
    // return first item by default if not set
    return hookLogs.value?.[0]
  },
  set: (val) => {
    _activeItem.value = val
  },
})

const showLogs = computed(
  () =>
    true ||
    !(
      appInfo.value.automationLogLevel === AutomationLogLevel.OFF ||
      (appInfo.value.automationLogLevel === AutomationLogLevel.ALL && !appInfo.value.ee)
    ),
)

async function loadHookLogs(page = logPaginationData.value.page, limit = logPaginationData.value.pageSize) {
  try {
    logPaginationData.value.page = page || 1
    logPaginationData.value.pageSize = limit || 10
    const { list, pageInfo } = await api.dbTableWebhookLogs.list(props.hook.id!, {
      offset: logPaginationData.value.pageSize * (logPaginationData.value.page - 1),
      limit,
    })
    hookLogs.value = parseHookLog(list)
    logPaginationData.value.totalRows = pageInfo.totalRows ?? 0
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
    await loadHookLogs()
  }
})
</script>

<template>
  <a-skeleton v-if="isLoading" />
  <div v-else class="h-full">
    <!--    <a-card class="!mb-[20px]" :body-style="{ padding: '10px' }">
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
    </a-card> -->

    <template v-if="showLogs">
      <a-empty v-if="!hookLogs.length" />
      <div v-else class="flex h-full">
        <div class="min-w-80 border-r-1 h-full">
          <WebhookCallLogList
            v-model:activeItem="activeItem"
            :hook-logs="hookLogs"
            :log-pagination-data="logPaginationData"
            @page-size-change="loadHookLogs(undefined, $event)"
            @page-change="loadHookLogs($event)"
          />
        </div>
        <div class="flex-grow min-w-100">
          <WebhookCallLogDetails :item="activeItem" />
        </div>
      </div>
    </template>
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

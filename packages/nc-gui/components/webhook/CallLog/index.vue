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
  <div
    class="h-full"
    :class="{
      'flex items-center justify-center': !hookLogs.length && !isLoading,
    }"
  >
    <template v-if="showLogs">
      <a-empty v-if="!hookLogs.length && !isLoading" />
      <div v-else class="flex h-full">
        <div class="min-w-80 border-r-1 h-full">
          <div
            v-if="isLoading"
            class="p-3 h-full flex flex-col gap-3 children:(border-b-1 border-nc-border-medium) overflow-auto nc-scrollbar-thin"
          >
            <a-skeleton
              v-for="idx in 7"
              :key="idx"
              :loading="isLoading"
              active
              :avatar="{ size: 'small' }"
              :paragraph="{
                rows: 2,
              }"
              :title="false"
            />
          </div>
          <WebhookCallLogList
            v-else
            v-model:active-item="activeItem"
            :hook-logs="hookLogs"
            :log-pagination-data="logPaginationData"
            @page-size-change="loadHookLogs(undefined, $event)"
            @page-change="loadHookLogs($event)"
          />
        </div>
        <div class="flex-grow min-w-100">
          <div v-if="isLoading" class="h-full p-3 overflow-auto nc-scrollbar-thin flex flex-col gap-6">
            <a-skeleton
              active
              :paragraph="false"
              class="!children:children:mt-0"
              :title="{
                width: '50%',
              }"
            />

            <div class="flex gap-x-5">
              <div class="min-w-80 flex-1">
                <a-skeleton
                  v-for="idx in 3"
                  :key="idx"
                  :loading="isLoading"
                  active
                  :paragraph="{
                    rows: 1,
                    width: '90%',
                  }"
                  :title="false"
                  class="min-w-80"
                />
              </div>
              <div class="min-w-80 flex-1">
                <a-skeleton
                  v-for="idx in 2"
                  :key="idx"
                  :loading="isLoading"
                  active
                  :paragraph="{
                    rows: 1,
                    width: '90%',
                  }"
                  :title="false"
                  class="min-w-80"
                />
              </div>
            </div>
            <div class="flex-1 flex items-stretch gap-4">
              <WebhookCallLogReqResDetailCardSkeleton title="Request" />
              <WebhookCallLogReqResDetailCardSkeleton title="Response" />
            </div>
          </div>
          <WebhookCallLogDetails v-else :item="activeItem" />
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

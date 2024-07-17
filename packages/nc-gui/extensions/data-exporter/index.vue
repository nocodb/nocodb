<script setup lang="ts">
import dayjs from 'dayjs'
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const { extension, tables, fullscreen, getViewsForTable } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

const showExportConfig = ref(false)

const exportedFiles = computed(() => {
  return jobList.value
    .filter((job) => job.job === 'data-export')
    .map((job) => {
      return {
        ...job,
        result: (job.result || {}) as { url: string; type: 'csv' | 'json' | 'xlsx'; title: string; timestamp: number },
      }
    })
    .sort((a, b) => dayjs(b.created_at).unix() - dayjs(a.created_at).unix())
})

const exportPayload = ref<{
  tableId?: string
  viewId?: string
}>({})

const tableList = computed(() => {
  return tables.value.map((table) => {
    return {
      label: table.title,
      value: table.id,
    }
  })
})

const viewList = computed(() => {
  if (!exportPayload.value.tableId) return []
  return (
    views.value
      .filter((view) => view.type === ViewTypes.GRID)
      .map((view) => {
        return {
          label: view.is_default ? `Default View` : view.title,
          value: view.id,
        }
      }) || []
  )
})

const reloadViews = async () => {
  if (exportPayload.value.tableId) {
    views.value = await getViewsForTable(exportPayload.value.tableId)
  }
}

const onTableSelect = async (tableId: string) => {
  exportPayload.value.tableId = tableId
  await reloadViews()
  exportPayload.value.viewId = views.value.find((view) => view.is_default)?.id
  await extension.value.kvStore.set('exportPayload', exportPayload.value)
}

const onViewSelect = async (viewId: string) => {
  exportPayload.value.viewId = viewId
  await extension.value.kvStore.set('exportPayload', exportPayload.value)
}

const isExporting = ref(false)

async function exportDataAsync() {
  try {
    if (isExporting.value || !exportPayload.value.viewId) return

    isExporting.value = true

    const jobData = await $api.export.data(exportPayload.value.viewId, 'csv', { extension_id: extension.value.id })
    jobList.value.unshift(jobData)

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            // Export completed successfully
            message.info('Successfully exported data!')

            const job = jobList.value.find((j) => j.id === data.id)
            if (job) {
              job.status = JobStatus.COMPLETED
              job.result = data.data?.result
            }

            isExporting.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to export data!')

            const job = jobList.value.find((j) => j.id === data.id)
            if (job) {
              job.status = JobStatus.FAILED
              job.result = data.data?.result

              // Add title if not present in response
              if (!job.result?.title) {
                job.result = {
                  ...(job.result || {}),
                  title: titleHelper(),
                }
              }
            }

            isExporting.value = false
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const urlHelper = (url: string) => {
  if (url.startsWith('http')) {
    return url
  } else {
    return `${appInfo.value.ncSiteUrl || BASE_FALLBACK_URL}/${url}`
  }
}

function titleHelper() {
  const table = tables.value.find((t) => t.id === exportPayload.value.tableId)
  const view = views.value.find((v) => v.id === exportPayload.value.viewId)

  return `${table?.title} (${view?.is_default ? 'Default View' : view?.title})`
}

onMounted(() => {
  exportPayload.value = extension.value.kvStore.get('exportPayload') || {}

  reloadViews()
  loadJobsForBase()
})

watch(
  [() => jobList.value?.length, () => exportPayload.value],
  () => {
    if (jobList.value?.length || Object.keys(exportPayload.value || {}).length) {
      showExportConfig.value = true
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="data-exporter">
    <div class="data-exporter-header">Recent Exports</div>
    <div class="data-exporter-body">
      <div v-if="!exportedFiles.length && !showExportConfig" class="min-h-[222px] h-full flex items-center justify-center">
        <NcButton type="link" size="small" class="!border-none" @click="showExportConfig = true">
          <div class="flex items-center gap-2 font-weight-600">
            <GeneralIcon icon="plus" />
            New download
          </div>
        </NcButton>
      </div>
      <div
        v-if="showExportConfig && exportPayload"
        class="px-3 py-2 flex items-center justify-between gap-2.5 flex-wrap"
        :class="{
          'border-b-1': exportedFiles.length || fullscreen,
        }"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-1">
            <NcSelect
              v-model:value="exportPayload.tableId"
              :options="tableList"
              placeholder="-select table-"
              :disabled="isExporting"
              class="min-w-[118px] max-w-[132px]"
              @change="onTableSelect"
            />
            <span>/</span>
            <NcSelect
              v-model:value="exportPayload.viewId"
              :options="viewList"
              placeholder="-select view-"
              :disabled="isExporting"
              class="min-w-[118px] max-w-[132px]"
              @change="onViewSelect"
            />
          </div>
          <!-- <div>Timestamp</div> -->
        </div>
        <div class="flex-none flex-1 flex justify-end">
          <NcButton :disabled="!exportPayload?.viewId" :loading="isExporting" size="xs" type="text" @click="exportDataAsync">{{
            isExporting ? 'Generating' : 'Export'
          }}</NcButton>
        </div>
      </div>
      <template v-if="exportedFiles.length">
        <template v-for="exp in exportedFiles">
          <div
            v-if="exp.status === JobStatus.COMPLETED ? exp.result : true"
            :key="exp.id"
            class="px-3 py-2 flex gap-2.5 justify-between border-b-1"
            :class="{
              'last:border-b-0': !fullscreen,
            }"
          >
            <div class="flex-1 flex gap-3 max-w-[calc(100%_-_114px)]">
              <div v-if="[JobStatus.COMPLETED, JobStatus.FAILED].includes(exp.status)" class="flex">
                <GeneralIcon
                  :icon="exp.status === JobStatus.COMPLETED ? 'circleCheck2' : 'alertTriangle'"
                  class="flex-none h-4 w-4"
                  :class="{
                    '!text-green-500': exp.status === JobStatus.COMPLETED,
                    '!text-red-500': exp.status === JobStatus.FAILED,
                  }"
                />
              </div>
              <div v-else class="h-5 flex items-center">
                <GeneralLoader size="regular" class="flex-none" />
              </div>

              <div class="flex-1 max-w-[calc(100%_-_28px)] flex flex-col gap-1">
                <div class="inline-flex gap-1 text-sm text-gray-800">
                  <span class="inline-flex items-center h-5">
                    <GeneralIcon icon="file" class="flex-none" />
                  </span>
                  <NcTooltip class="truncate max-w-[calc(100%_-_20px)]" show-on-truncate-only>
                    <template #title>
                      {{ exp.result.title || titleHelper() }}
                    </template>
                    {{ exp.result.title || titleHelper() }}
                  </NcTooltip>
                </div>
                <div v-if="exp.result.timestamp" class="text-[10px] leading-4 text-gray-600">
                  <NcTooltip class="truncate" show-on-truncate-only>
                    <template #title>
                      {{ dayjs(exp.result.timestamp).format('MM/DD/YYYY [at] hh:mm A') }}
                    </template>
                    {{ dayjs(exp.result.timestamp).format('MM/DD/YYYY [at] hh:mm A') }}
                  </NcTooltip>
                </div>
              </div>
            </div>
            <div if="exp.status === JobStatus.COMPLETED">
              <a :href="urlHelper(exp.result.url)" target="_blank">
                <NcButton type="secondary" size="xs">
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="download" />
                    <span>
                      {{ $t('general.download') }}
                    </span>
                  </div>
                </NcButton></a
              >
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.data-exporter {
  @apply flex flex-col rounded-lg border-1 overflow-hidden h-full;
  .data-exporter-header {
    @apply px-3 py-1 uppercase bg-gray-100 text-[11px] leading-4 text-gray-600;
  }

  .data-exporter-body {
    @apply flex-1;
  }

  .data-exporter-footer {
    @apply flex items-center justify-end bg-gray-100;
  }
}
</style>

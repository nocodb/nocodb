<script setup lang="ts">
import dayjs from 'dayjs'
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const jobStatusTooltip = {
  [JobStatus.COMPLETED]: 'Export successful',
  [JobStatus.FAILED]: 'Export failed',
} as Record<string, string>

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const { extension, tables, fullscreen, getViewsForTable } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

const deletedExports = ref<string[]>([])

const dataExporterRef = ref<HTMLDivElement>()

const { width } = useElementSize(dataExporterRef)

const exportedFiles = computed(() => {
  return jobList.value
    .filter(
      (job) =>
        job.job === 'data-export' && job.result?.extension_id === extension.value.id && !deletedExports.value.includes(job.id),
    )
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
      meta: table.meta,
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
          meta: view.meta,
          type: view.type,
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

const handleDownload = async (url: string) => {
  const isExpired = await isLinkExpired(url)

  if (isExpired) {
    navigateTo(url, {
      open: navigateToBlankTargetOpenOption,
    })
    return
  }

  const link = document.createElement('a')
  link.href = url
  link.style.display = 'none' // Hide the link

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function titleHelper() {
  const table = tables.value.find((t) => t.id === exportPayload.value.tableId)
  const view = views.value.find((v) => v.id === exportPayload.value.viewId)

  return `${table?.title} (${view?.is_default ? 'Default View' : view?.title})`
}

const onRemoveExportedFile = async (exportId: string) => {
  deletedExports.value.push(exportId)

  await extension.value.kvStore.set('deletedExports', deletedExports.value)
}

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

onMounted(() => {
  exportPayload.value = extension.value.kvStore.get('exportPayload') || {}
  deletedExports.value = extension.value.kvStore.get('deletedExports') || []
  reloadViews()
  loadJobsForBase()
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div ref="dataExporterRef" class="data-exporter">
      <div class="pb-3 flex items-center justify-between gap-2.5 flex-wrap">
        <div
          class="flex-1 flex items-center"
          :class="{
            'max-w-[min(350px,calc(100%-124px))]': isExporting && !fullscreen && width > 325,
            'max-w-[min(350px,calc(100%_-_84px))]': !isExporting && !fullscreen && width > 325,
            'max-w-full': width <= 325,
            'max-w-[900px]': fullscreen,
          }"
        >
          <NcSelect
            v-model:value="exportPayload.tableId"
            placeholder="-select table-"
            :disabled="isExporting"
            class="nc-data-exporter-table-select"
            :class="{
              'flex-1 max-w-[240px]': fullscreen,
              'min-w-1/2 max-w-[175px]': !fullscreen,
            }"
            :filter-option="filterOption"
            dropdown-class-name="w-[250px]"
            show-search
            @change="onTableSelect"
          >
            <a-select-option v-for="table of tableList" :key="table.label" :value="table.value">
              <div class="w-full flex items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralTableIcon :meta="{ meta: table.meta }" class="text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ table.label }}</template>
                  <span>{{ table.label }}</span>
                </NcTooltip>
                <component
                  :is="iconMap.check"
                  v-if="exportPayload.tableId === table.value"
                  id="nc-selected-item-icon"
                  class="flex-none text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </NcSelect>

          <NcSelect
            v-model:value="exportPayload.viewId"
            placeholder="-select view-"
            :disabled="isExporting"
            class="nc-data-exporter-view-select"
            :class="{
              'flex-1 max-w-[240px]': fullscreen,
              'min-w-1/2 max-w-[175px]': !fullscreen,
            }"
            dropdown-class-name="w-[250px]"
            :filter-option="filterOption"
            show-search
            @change="onViewSelect"
          >
            <a-select-option v-for="view of viewList" :key="view.label" :value="view.value">
              <div class="w-full flex items-center gap-2">
                <div class="min-w-5 flex items-center justify-center">
                  <GeneralViewIcon :meta="{ meta: view.meta, type: view.type }" class="flex-none text-gray-500" />
                </div>
                <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                  <template #title>{{ view.label }}</template>
                  <span>{{ view.label }}</span>
                </NcTooltip>
                <component
                  :is="iconMap.check"
                  v-if="exportPayload.viewId === view.value"
                  id="nc-selected-item-icon"
                  class="flex-none text-primary w-4 h-4"
                />
              </div> </a-select-option
          ></NcSelect>
        </div>
        <div class="flex-none flex justify-end">
          <NcTooltip class="flex" placement="topRight" :disabled="!isExporting">
            <template #title> The CSV file is being prepared in the background. You'll be notified once it's ready. </template>
            <NcButton :disabled="!exportPayload?.viewId" :loading="isExporting" size="xs" @click="exportDataAsync">{{
              isExporting ? 'Generating' : 'Export'
            }}</NcButton>
          </NcTooltip>
        </div>
      </div>
      <div class="data-exporter-body flex-1 flex flex-col">
        <div class="data-exporter-header">Recent Exports</div>
        <div v-if="exportedFiles.length" class="flex-1 flex flex-col nc-scrollbar-thin max-h-[calc(100%_-_25px)]">
          <template v-for="exp of exportedFiles">
            <div
              v-if="exp.status === JobStatus.COMPLETED ? exp.result : true"
              :key="exp.id"
              class="px-3 py-2 flex gap-2 justify-between border-b-1 hover:bg-gray-50"
              :class="{
                'px-4 py-3': fullscreen,
                'px-3 py-2': !fullscreen,
              }"
            >
              <div
                class="flex-1 flex items-center gap-3"
                :class="{
                  'max-w-[calc(100%_-_74px)]': exp.status === JobStatus.COMPLETED,
                  'max-w-[calc(100%_-_38px)]': exp.status !== JobStatus.COMPLETED,
                }"
              >
                <NcTooltip v-if="[JobStatus.COMPLETED, JobStatus.FAILED].includes(exp.status)" class="flex">
                  <template #title>
                    {{ jobStatusTooltip[exp.status] }}
                  </template>
                  <GeneralIcon
                    :icon="exp.status === JobStatus.COMPLETED ? 'circleCheckSolid' : 'alertTriangleSolid'"
                    class="flex-none h-5 w-5"
                    :class="{
                      '!text-green-700': exp.status === JobStatus.COMPLETED,
                      '!text-red-700': exp.status === JobStatus.FAILED,
                    }"
                  />
                </NcTooltip>
                <div v-else class="h-5 flex items-center">
                  <GeneralLoader size="regular" class="flex-none" />
                </div>

                <div class="flex-1 max-w-[calc(100%_-_28px)] flex flex-col gap-1">
                  <div class="inline-flex gap-1 text-sm text-gray-800 -ml-[1px]">
                    <span class="inline-flex items-center h-5">
                      <GeneralIcon icon="file" class="flex-none text-gray-600/80 h-3.5 w-3.5" />
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

              <div
                v-if="exp.status === JobStatus.COMPLETED"
                class="flex items-center"
                @click="handleDownload(urlHelper(exp.result.url))"
              >
                <NcTooltip class="flex items-center">
                  <template #title>
                    {{ $t('general.download') }}
                  </template>

                  <NcButton type="secondary" size="xs" class="!px-[5px]">
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="download" />
                    </div>
                  </NcButton>
                </NcTooltip>
              </div>

              <div class="flex items-center">
                <NcTooltip class="flex">
                  <template #title>
                    {{ $t('general.remove') }}
                  </template>

                  <NcButton type="text" size="xs" class="!px-[5px]" @click="onRemoveExportedFile(exp.id)">
                    <GeneralIcon icon="close" />
                  </NcButton>
                </NcTooltip>
              </div>
            </div>
          </template>
        </div>
        <div v-else class="px-3 py-2 flex-1 flex items-center justify-center text-gray-600">No exports</div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
.data-exporter {
  @apply flex flex-col overflow-hidden h-full;
  .data-exporter-header {
    @apply px-3 py-1 bg-gray-100 text-[11px] leading-4 text-gray-600 border-b-1;
  }

  .nc-data-exporter-table-select {
    :deep(.ant-select-selector) {
      @apply !border-r-[0.5px] rounded-lg !rounded-r-none shadow-none;
    }
  }
  .nc-data-exporter-view-select {
    :deep(.ant-select-selector) {
      @apply !border-l-[0.5px] rounded-lg !rounded-l-none shadow-none;
    }
  }

  .data-exporter-body {
    @apply flex-1 rounded-lg border-1 overflow-hidden;
  }

  .data-exporter-footer {
    @apply flex items-center justify-end bg-gray-100;
  }
}
</style>

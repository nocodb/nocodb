<script setup lang="ts">
import dayjs from 'dayjs'
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const jobStatusTooltip = {
  [JobStatus.COMPLETED]: 'Export successful',
  [JobStatus.FAILED]: 'Export failed',
} as Record<string, string>

const delimiters = [
  {
    label: ',',
    value: ',',
  },
  {
    label: ';',
    value: ';',
  },
  {
    label: '|',
    value: '|',
  },
  {
    label: '<Tab>',
    value: '\\t',
  },
]

const encodings = [
  { label: 'ASCII', value: 'ascii' },
  { label: 'UTF-8', value: 'utf8' },
  { label: 'UTF-8 with hyphen', value: 'utf-8' },
  { label: 'UTF-16 LE', value: 'utf16le' },
  { label: 'UCS-2', value: 'ucs2' },
  { label: 'UCS-2 with hyphen', value: 'ucs-2' },
  { label: 'Base64', value: 'base64' },
  { label: 'Base64 URL', value: 'base64url' },
  { label: 'Latin-1', value: 'latin1' },
  { label: 'Binary', value: 'binary' },
  { label: 'Hexadecimal', value: 'hex' },
]

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)

const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

const { eventBus } = useExtensions()

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
      const isNew = job.result?.timestamp ? dayjs().diff(job.result?.timestamp) < 10000 : false

      return {
        ...job,
        result: { ...(job.result || {}), isNew } as {
          url: string
          type: 'csv' | 'json' | 'xlsx'
          title: string
          timestamp: number
          isNew: boolean
        },
      }
    })
    .sort((a, b) => dayjs(b.created_at).unix() - dayjs(a.created_at).unix())
})

const exportPayload = ref<{
  tableId?: string
  viewId?: string
  delimiter?: string
  encoding?: BufferEncoding
}>({
  delimiter: ',',
  encoding: 'utf8',
})

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

const saveChanges = async () => {
  await extension.value.kvStore.set('exportPayload', exportPayload.value)
}

const onTableSelect = async (tableId?: string) => {
  if (!tableId) {
    exportPayload.value.tableId = activeTableId.value
    await reloadViews()
    exportPayload.value.viewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.id === activeViewTitleOrId.value)?.id
      : views.value.find((view) => view.is_default)?.id
  } else {
    exportPayload.value.tableId = tableId
    await reloadViews()
    exportPayload.value.viewId = views.value.find((view) => view.is_default)?.id
  }

  await saveChanges()
}

const onViewSelect = async (viewId: string) => {
  exportPayload.value.viewId = viewId
  await saveChanges()
}

const isExporting = ref(false)

async function exportDataAsync() {
  try {
    if (isExporting.value || !exportPayload.value.viewId) return

    isExporting.value = true

    const jobData = await $api.export.data(exportPayload.value.viewId, 'csv', {
      extension_id: extension.value.id,
      delimiter: exportPayload.value.delimiter,
      encoding: exportPayload.value.encoding,
    })
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

eventBus.on(async (event, payload) => {
  if (event === ExtensionsEvents.CLEARDATA && payload && extension.value.id && payload === extension.value.id) {
    const deleteExportsPayload = exportedFiles.value.map((exp) => exp.id)

    if (deleteExportsPayload.length) {
      deletedExports.value.push(...deleteExportsPayload)
      await extension.value.kvStore.set('deletedExports', deletedExports.value)
    }
  }
})

onMounted(async () => {
  exportPayload.value = extension.value.kvStore.get('exportPayload') || {}
  exportPayload.value.delimiter = exportPayload.value.delimiter || ','
  exportPayload.value.encoding = exportPayload.value.encoding || 'utf-8'

  deletedExports.value = extension.value.kvStore.get('deletedExports') || []

  await reloadViews()
  await loadJobsForBase()

  if (!exportPayload.value.tableId && tableList.value.find((table) => table.value === activeTableId.value)) {
    onTableSelect()
  }
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div
      ref="dataExporterRef"
      class="data-exporter"
      :class="{
        'bg-nc-bg-gray-extralight': fullscreen,
      }"
    >
      <div
        class="p-3 flex flex-col gap-3"
        :class="{
          'bg-white': fullscreen,
        }"
      >
        <div
          class="flex items-center justify-between gap-2.5 flex-wrap"
          :class="{
            'bg-white': fullscreen,
          }"
        >
          <div
            class="nc-data-exporter-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default"
            :class="{
              'max-w-[min(400px,calc(100%-131px))]': isExporting && !fullscreen && width > 425,
              'max-w-[min(400px,calc(100%_-_87px))]': !isExporting && !fullscreen && width > 425,
              'max-w-full': width <= 425,
              'max-w-[474px]': fullscreen,
            }"
          >
            <a-form-item
              class="!my-0"
              :class="{
                'flex-1 max-w-[237px]': fullscreen,
                'min-w-1/2 max-w-[200px]': !fullscreen,
              }"
            >
              <NcSelect
                v-model:value="exportPayload.tableId"
                placeholder="-select table-"
                :disabled="isExporting"
                class="nc-data-exporter-table-select nc-select-shadow"
                :filter-option="filterOption"
                dropdown-class-name="w-[250px]"
                show-search
                size="large"
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
            </a-form-item>

            <a-form-item
              class="!my-0"
              :class="{
                'flex-1 max-w-[237px]': fullscreen,
                'min-w-1/2 max-w-[200px]': !fullscreen,
              }"
            >
              <NcSelect
                v-model:value="exportPayload.viewId"
                placeholder="-select view-"
                :disabled="isExporting"
                class="nc-data-exporter-view-select nc-select-shadow"
                dropdown-class-name="w-[250px]"
                :filter-option="filterOption"
                show-search
                size="large"
                placement="bottomRight"
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
            </a-form-item>
          </div>
          <div class="flex-none flex justify-end">
            <NcTooltip class="flex" placement="topRight" :disabled="!isExporting">
              <template #title> The CSV file is being prepared in the background. You'll be notified once it's ready. </template>
              <NcButton
                :disabled="!exportPayload?.viewId || isExporting"
                :loading="isExporting"
                size="medium"
                @click="exportDataAsync"
                >{{ isExporting ? 'Generating' : 'Export' }}</NcButton
              >
            </NcTooltip>
          </div>
        </div>

        <div
          v-if="fullscreen"
          class="flex items-center gap-3 flex-wrap"
          :class="{
            'max-w-[474px]': fullscreen,
          }"
        >
          <div class="flex items-center gap-2 flex-1">
            <div class="min-w-[65px]">Separator</div>
            <a-form-item class="!my-0 flex-1">
              <NcSelect
                v-model:value="exportPayload.delimiter"
                placeholder="-select separator-"
                :disabled="isExporting"
                class="nc-data-exporter-separator nc-select-shadow"
                dropdown-class-name="w-[180px]"
                @change="saveChanges"
              >
                <a-select-option v-for="delimiter of delimiters" :key="delimiter.value" :value="delimiter.value">
                  <div class="w-full flex items-center gap-2">
                    <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                      <template #title>{{ delimiter.label }}</template>
                      <span>{{ delimiter.label }}</span>
                    </NcTooltip>
                    <component
                      :is="iconMap.check"
                      v-if="exportPayload.delimiter === delimiter.value"
                      id="nc-selected-item-icon"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </NcSelect>
            </a-form-item>
          </div>
          <div class="flex items-center gap-2 flex-1">
            <div class="min-w-[65px]">Encoding</div>
            <a-form-item class="!my-0 flex-1">
              <NcSelect
                v-model:value="exportPayload.encoding"
                placeholder="-select separator-"
                class="nc-csv-import-separator nc-select-shadow"
                dropdown-class-name="w-[190px]"
                @change="saveChanges"
              >
                <a-select-option v-for="encoding of encodings" :key="encoding.value" :value="encoding.value">
                  <div class="w-full flex items-center gap-2">
                    <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                      <template #title>{{ encoding.label }}</template>
                      <span>{{ encoding.label }}</span>
                    </NcTooltip>
                    <component
                      :is="iconMap.check"
                      v-if="exportPayload.encoding === encoding.value"
                      id="nc-selected-item-icon"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </div>
                </a-select-option>
              </NcSelect>
            </a-form-item>
          </div>
        </div>
      </div>
      <div
        class="data-exporter-body flex-1 flex flex-col"
        :class="{
          'rounded-lg border-1 m-3': fullscreen,
        }"
      >
        <div class="data-exporter-header">Recent Exports</div>
        <div v-if="exportedFiles.length" class="flex-1 flex flex-col nc-scrollbar-thin max-h-[calc(100%_-_25px)]">
          <template v-for="exp of exportedFiles">
            <div
              v-if="exp.status === JobStatus.COMPLETED ? exp.result : true"
              :key="exp.id"
              class="p-3 flex gap-2 justify-between border-b-1"
              :class="{
                'px-4 py-3': fullscreen,
                'px-3 py-2': !fullscreen,
                'bg-white hover:bg-gray-50': exp.status === JobStatus.COMPLETED,
                'bg-nc-bg-red-light': exp.status !== JobStatus.COMPLETED,
              }"
            >
              <div
                class="flex-1 flex items-start gap-3"
                :class="{
                  'max-w-[calc(100%_-_74px)]': exp.status === JobStatus.COMPLETED && !exp.result.isNew,
                  'max-w-[calc(100%_-_113px)]': exp.status === JobStatus.COMPLETED && exp.result.isNew,
                  'max-w-[calc(100%_-_48px)]': exp.status !== JobStatus.COMPLETED && !exp.result.isNew,
                  'max-w-[calc(100%_-_85px)]': exp.status !== JobStatus.COMPLETED && exp.result.isNew,
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

                  <div v-if="exp.result.timestamp" name="error" class="text-small leading-[18px] text-nc-content-gray-muted">
                    {{ timeAgo(dayjs(exp.result.timestamp).toString()) }}
                  </div>
                </div>
              </div>

              <div v-if="exp.result.isNew" class="flex h-7 flex items-center">
                <NcBadge color="green" :border="false" class="!bg-nc-bg-green-light !text-nc-content-green-dark">{{
                  $t('general.new')
                }}</NcBadge>
              </div>
              <div v-if="exp.status === JobStatus.COMPLETED" class="flex" @click="handleDownload(urlHelper(exp.result.url))">
                <NcTooltip class="flex">
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

              <div class="flex">
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
        <div v-else class="px-3 py-2 flex-1 flex items-center justify-center text-gray-800">
          <a-empty
            :image-style="{
              height: '24px',
            }"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
            description="No exports"
            class="!my-0"
          />
        </div>
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

  .nc-data-exporter-select-wrapper {
    &:not(:focus-within) {
      &::after {
        @apply absolute left-1/2 h-full content-[''] border-r-1 border-nc-border-gray-medium;
      }
    }
  }

  :deep(.nc-data-exporter-table-select.ant-select) {
    &.ant-select-focused {
      .ant-select-selector {
        @apply z-10 !rounded-r-lg;
      }
    }

    &:not(.ant-select-focused) {
      .ant-select-selector {
        @apply !border-transparent !shadow-none;
      }
    }

    .ant-select-selector {
      @apply relative !rounded-lg !text-sm;
    }
  }

  :deep(.nc-data-exporter-view-select.ant-select) {
    &.ant-select-focused {
      .ant-select-selector {
        @apply z-10 !rounded-l-lg;
      }
    }

    &:not(.ant-select-focused) {
      .ant-select-selector {
        @apply !border-transparent !shadow-none;
      }
    }

    .ant-select-selector {
      @apply relative !rounded-lg !text-sm;
    }
  }

  :deep(.nc-data-exporter-separator.ant-select) {
    .ant-select-selector {
      @apply !rounded-lg h-8;
    }
  }

  .data-exporter-body {
    @apply flex-1 overflow-hidden;
  }

  .data-exporter-footer {
    @apply flex items-center justify-end bg-gray-100;
  }
}
</style>

<style lang="scss">
.nc-nc-data-exporter .extension-content {
  @apply !p-0;

  &.fullscreen {
    .extension-header {
      @apply !border-b-transparent;
    }
  }
}
</style>

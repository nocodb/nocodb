<script setup lang="ts">
import dayjs from 'dayjs'
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const { extension, tables, fullscreen, getViewsForTable } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

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

    const jobData = await $api.export.data(exportPayload.value.viewId, 'csv', {})

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

const titleHelper = () => {
  const table = tables.value.find((t) => t.id === exportPayload.value.tableId)
  const view = views.value.find((v) => v.id === exportPayload.value.viewId)

  return `${table?.title} (${view?.is_default ? 'Default View' : view?.title})`
}

onMounted(() => {
  exportPayload.value = extension.value.kvStore.get('exportPayload') || {}
  reloadViews()
  loadJobsForBase()
})
</script>

<template>
  <div class="flex flex-col gap-2 p-2">
    <NcSelect v-model:value="exportPayload.tableId" :options="tableList" @disabled="isExporting" @change="onTableSelect" />
    <NcSelect v-model:value="exportPayload.viewId" :options="viewList" @disabled="isExporting" @change="onViewSelect" />
    <NcButton @loading="isExporting" @click="exportDataAsync">Export</NcButton>
    <div
      class="flex flex-col"
      :class="{
        'max-h-[60px] overflow-auto': !fullscreen,
      }"
    >
      <div v-for="exp in exportedFiles" :key="exp.id" class="flex items-center gap-1">
        <template v-if="exp.status === JobStatus.COMPLETED && exp.result">
          <GeneralIcon icon="file" />
          <div>{{ exp.result.title }}</div>
          <a :href="urlHelper(exp.result.url)" target="_blank">Download</a>
        </template>
        <template v-else-if="exp.status === JobStatus.FAILED">
          <GeneralIcon icon="error" class="text-red-500" />
          <div>{{ exp.result.title }}</div>
        </template>
        <template v-else>
          <GeneralLoader size="small" />
          <div>{{ titleHelper() }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss"></style>

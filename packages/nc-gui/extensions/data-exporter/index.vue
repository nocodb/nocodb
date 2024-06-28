<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const { extension, tables, getViewsForTable } = useExtensionHelperOrThrow()

const views = ref<ViewType[]>([])

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
          label: view.is_default ? `Default` : view.title,
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

const downloadLink = ref<string>()

async function exportDataAsync() {
  try {
    if (isExporting.value || !exportPayload.value.viewId) return

    isExporting.value = true

    const jobData = await $api.export.data(exportPayload.value.viewId, 'csv', {})

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

            const url = data.data?.result?.url

            if (url.startsWith('http')) {
              downloadLink.value = url
            } else {
              downloadLink.value = `${appInfo.value.ncSiteUrl || BASE_FALLBACK_URL}/${url}`
            }

            isExporting.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to export data!')
            isExporting.value = false
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onMounted(() => {
  exportPayload.value = extension.value.kvStore.get('exportPayload') || {}
  reloadViews()
})
</script>

<template>
  <div class="flex flex-col gap-2 p-2">
    <NcSelect v-model:value="exportPayload.tableId" :options="tableList" @change="onTableSelect" />
    <NcSelect v-model:value="exportPayload.viewId" :options="viewList" @change="onViewSelect" />
    <template v-if="downloadLink">
      <a class="w-full h-full" :href="downloadLink" target="_blank" rel="noopener noreferrer">
        <NcButton class="w-full h-full">Download</NcButton>
      </a>
      <NcButton @click="downloadLink = ''">Clear</NcButton>
    </template>
    <NcButton v-else @loading="isExporting" @click="exportDataAsync">Export</NcButton>
  </div>
</template>

<style lang="scss"></style>

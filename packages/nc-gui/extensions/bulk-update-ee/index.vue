<script setup lang="ts">
import dayjs from 'dayjs'
import { type ViewType, ViewTypes } from 'nocodb-sdk'

const jobStatusTooltip = {
  [JobStatus.COMPLETED]: 'Export successful',
  [JobStatus.FAILED]: 'Export failed',
} as Record<string, string>

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const router = useRouter()
const route = router.currentRoute

const activeTableId = computed(() => route.value.params.viewId as string | undefined)

const activeViewTitleOrId = computed(() => {
  return route.value.params.viewTitle
})

interface BulkUpdatePayloadType {
  activeTableId?: string
  activeViewId?: string
  history: BulkUpdateHistory[]
}

interface BulkUpdateHistory {
  tableId?: string
  viewId?: string
  config: BulkUpdateFieldConfig[]
}

interface BulkUpdateFieldConfig {
  id: string
  columnId?: string
  op_type?: string
  value?: any
}

const bulkUpdatePayloadPlaceholder: BulkUpdatePayloadType = {
  activeTableId: '',
  activeViewId: '',
  history: [],
}

const { extension, tables, fullscreen, getViewsForTable } = useExtensionHelperOrThrow()

const { jobList, loadJobsForBase } = useJobs()

const views = ref<ViewType[]>([])

const deletedExports = ref<string[]>([])

const bulkUpdateRef = ref<HTMLDivElement>()

const { width } = useElementSize(bulkUpdateRef)

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

const savedPayloads = ref<BulkUpdatePayloadType>(bulkUpdatePayloadPlaceholder)

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
  if (!savedPayloads.value.activeTableId) return []
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

const isDataLoaded = ref(false)

const bulkUpdatePayload = computedAsync(async () => {
  if (!isDataLoaded.value && !savedPayloads.value.history?.length) {
    let saved = (await extension.value.kvStore.get('savedPayloads')) as BulkUpdatePayloadType
    console.log('on mounted')
    if (saved) {
      saved.history = saved.history || []

      const deletedTableIds = new Set<string>()

      const deletedViewIds = new Set<string>()

      const availableTables: string[] = (tableList.value || []).map((t) => t.value) || []

      for (const h of saved.history) {
        if (h.tableId && !availableTables.includes(h.tableId)) {
          deletedTableIds.add(h.tableId)
        }
      }

      saved.history = saved.history.filter((h) => (h.tableId && deletedTableIds.has(h.tableId) ? false : true))

      if (saved.activeTableId && deletedTableIds.has(saved.activeTableId)) {
        saved.activeTableId = ''
        saved.activeViewId = ''
      }

      savedPayloads.value = saved

      await reloadViews()

      /**
       * Todo: remove history object if table view is deleted
       */

      if (!savedPayloads.value.activeTableId && tableList.value.find((table) => table.value === activeTableId.value)) {
        onTableSelect()
      }

      isDataLoaded.value = true
    }
  }

  if (savedPayloads.value.activeTableId && savedPayloads.value.activeViewId) {
    const historyIndex = savedPayloads.value.history.findIndex(
      (h) => h.tableId === savedPayloads.value.activeTableId && h.viewId === savedPayloads.value.activeViewId,
    )

    if (historyIndex !== -1) {
      return savedPayloads.value.history[historyIndex]
    } else {
      savedPayloads.value.history.push({
        tableId: savedPayloads.value.activeTableId,
        viewId: savedPayloads.value.activeViewId,
        config: [],
      })

      return savedPayloads.value.history[savedPayloads.value.history.length - 1]
    }
  }
})

async function reloadViews() {
  if (!savedPayloads.value.activeTableId) return

  views.value = await getViewsForTable(savedPayloads.value.activeTableId)
}

async function onTableSelect(tableId?: string) {
  if (!tableId) {
    savedPayloads.value.activeTableId = activeTableId.value
    await reloadViews()
    savedPayloads.value.activeViewId = activeViewTitleOrId.value
      ? views.value.find((view) => view.id === activeViewTitleOrId.value)?.id
      : views.value.find((view) => view.is_default)?.id
  } else {
    savedPayloads.value.activeTableId = tableId
    await reloadViews()
    savedPayloads.value.activeViewId = views.value.find((view) => view.is_default)?.id
  }

  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const onViewSelect = async (viewId: string) => {
  savedPayloads.value.activeViewId = viewId
  await extension.value.kvStore.set('savedPayloads', savedPayloads.value)
}

const isExporting = ref(false)

const filterOption = (input: string, option: { key: string }) => {
  return option.key?.toLowerCase()?.includes(input?.toLowerCase())
}

onMounted(async () => {
  await loadJobsForBase()
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <template v-if="fullscreen" #headerExtra>
      <NcButton size="small">Update Records</NcButton>
    </template>

    <div
      ref="bulkUpdateRef"
      class="bulk-update-ee"
      :class="{
        'p-4': fullscreen,
      }"
    >
      <div class="p-3 flex items-center justify-between gap-2.5 flex-wrap">
        <div
          class="nc-data-exporter-select-wrapper flex-1 flex items-center border-1 border-nc-border-gray-medium rounded-lg relative shadow-default max-w-[474px]"
        >
          <a-form-item
            class="!my-0"
            :class="{
              'flex-1 max-w-[237px]': fullscreen,
              'min-w-1/2 max-w-[200px]': !fullscreen,
            }"
          >
            <NcSelect
              v-model:value="savedPayloads.activeTableId"
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
                    v-if="savedPayloads.activeTableId === table.value"
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
              v-model:value="savedPayloads.activeViewId"
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
                    v-if="savedPayloads.activeViewId === view.value"
                    id="nc-selected-item-icon"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div> </a-select-option
            ></NcSelect>
          </a-form-item>
        </div>
      </div>
      <div class="data-exporter-body flex-1 flex flex-col">
        <div class="data-exporter-header">Actions</div>
        <div
          v-if="bulkUpdatePayload && bulkUpdatePayload.config?.length"
          class="flex-1 flex flex-col nc-scrollbar-thin max-h-[calc(100%_-_25px)]"
        ></div>
        <div v-else class="px-3 py-4 min-h-[120px] flex-1 flex flex-col gap-3 items-center justify-center text-gray-600">
          <div>No fields set</div>
          <NcButton size="small">
            <template #icon>
              <GeneralIcon icon="ncPlus" />
            </template>
            Add fields to update
          </NcButton>
        </div>
      </div>
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
.nc-nc-bulk-update .bulk-update-ee {
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
  .data-exporter-body {
    @apply flex-1 overflow-hidden;
  }

  .data-exporter-footer {
    @apply flex items-center justify-end bg-gray-100;
  }
}
</style>

<style lang="scss">
.nc-nc-data-exporter {
}
</style>

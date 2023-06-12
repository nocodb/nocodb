<script lang="ts" setup>
import type { DataConfigNumber, DataSourceInternal, NumberWidget } from 'nocodb-sdk'
import { Icon as IconifyIcon } from '@iconify/vue'
import { GeneralAddBaseButton, GeneralIcon } from '~~/.nuxt/components'
const props = defineProps<{
  widgetConfig: NumberWidget
}>()

const { api } = useApi()

const { widgetConfig } = toRefs(props)
const aggregatedNumberValue = ref<number | undefined>()
const description = ref<string | undefined>()
// const icon = ref<string>('default-icon')
const numberColumnTitle = ref<string | undefined>()
const aggregateFunction = ref<string>('Description')

const dashboardStore = useDashboardStore()
const { reloadWidgetDataEventBus } = dashboardStore
const { openedLayoutSidebarNode } = storeToRefs(dashboardStore)

const data_source = computed(() => widgetConfig.value?.data_source as DataSourceInternal)
const data_config = computed(() => widgetConfig.value?.data_config as DataConfigNumber)

const dataLinkConfigIsMissing = computed(() => {
  return (
    !data_source.value ||
    !data_source?.value.projectId ||
    !data_source?.value.tableId ||
    !data_source.value.viewId ||
    !(
      (data_config.value.colId && data_config.value.aggregateFunction) ||
      data_config.value.recordCountOrFieldSummary === 'record_count'
    )
  )
})

const getData = async () => {
  if (!widgetConfig.value.id || dataLinkConfigIsMissing.value) {
    console.error('Tried to get data for Number Visualisation without complete data link configuration')
    return
  }
  const widgetData: any = await (await api.dashboard.widgetGet(openedLayoutSidebarNode.value!.id!, widgetConfig.value.id)).data
  aggregatedNumberValue.value = widgetData.value
  numberColumnTitle.value = widgetData.columnName
  aggregateFunction.value = widgetData.aggregateFunction
  description.value = widgetData.description || 'Descritpion'

  // icon.value = widgetData.icon || 'default-icon'
}

reloadWidgetDataEventBus.on(async (ev) => {
  if (ev !== widgetConfig.value.id) {
    return
  }
  await getData()
})

onMounted(async () => {
  await getData()
})

watch(
  widgetConfig,
  async () => {
    if (!dataLinkConfigIsMissing.value) {
      await getData()
    }
  },
  {
    deep: true,
    immediate: true,
  },
)
const columnTitleWithAggregateFnLabel = computed(() => {
  return data_config.value.recordCountOrFieldSummary === 'field_summary'
    ? `${numberColumnTitle.value} (${aggregateFunction.value})`
    : 'Value'
})
</script>

<template>
  <div class="h-full">
    <div class="flex flex-col justify-between h-full">
      <!-- <a-statistic :title="columnTitleWithAggregateFnLabel" :value="aggregatedNumberValue" /> -->
      <div class="flex justify-between">
        <div class="flex flex-col">
          <h3 class="text-base font-medium text-gray-900 mb-1">{{ columnTitleWithAggregateFnLabel }}</h3>
          <h4 class="font-normal text-gray-400 text-xs">{{ description }}</h4>
        </div>
        <!-- TODO make icon a dynamic value -->
        <IconifyIcon class="bg-blue-100 p-2 rounded h-10 min-w-10 text-lg" icon="iconoir:dollar"></IconifyIcon>
      </div>
      <div class="">
        <h2 v-if="dataLinkConfigIsMissing" class="text-5xl text-center mb-0">N/A</h2>
        <h1 v-else class="text-8xl text-center mb-0">{{ aggregatedNumberValue }}</h1>
      </div>
    </div>
  </div>
</template>

<style>
.ant-statistic-content-value {
  @apply text-8xl text-center;
}

.ant-statistic-content {
  @apply flex justify-center;
}

.ant-statistic-title {
  @apply text-base font-medium text-gray-900;
}
</style>

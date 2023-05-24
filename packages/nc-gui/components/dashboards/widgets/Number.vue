<script lang="ts" setup>
import type { DataConfigNumber, DataSourceInternal, NumberWidget } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: NumberWidget
}>()

const { api } = useApi()

const { widgetConfig } = toRefs(props)
const aggregatedNumberValue = ref<number | undefined>()
const numberColumnTitle = ref<string | undefined>()
const aggregateFunction = ref<string | undefined>()

const dashboardStore = useDashboardStore()
const { reloadWidgetDataEventBus } = dashboardStore
const { openedLayoutSidebarNode } = storeToRefs(dashboardStore)

const dataLinkConfigIsMissing = computed(() => {
  const data_source = widgetConfig.value?.data_source as DataSourceInternal
  const data_config = widgetConfig.value?.data_config as DataConfigNumber
  return (
    !data_source ||
    !data_source?.projectId ||
    !data_source?.tableId ||
    !data_source.viewId ||
    !data_config.colId ||
    !data_config.aggregateFunction
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
  return `${numberColumnTitle.value} (${aggregateFunction.value})`
})
</script>

<template>
  <div>
    <div v-if="dataLinkConfigIsMissing">Missing Data Source Configuration</div>
    <a-card v-else>
      <a-statistic :title="columnTitleWithAggregateFnLabel" :value="aggregatedNumberValue" style="margin-right: 50px"
    /></a-card>
  </div>
</template>

<style></style>

<script lang="ts" setup>
import type { DataConfigNumber, DataSourceInternal, NumberWidget } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: NumberWidget
}>()

const { api } = useApi()

const { widgetConfig } = toRefs(props)
// const numberWidgetId = numberWidget.value.id
// TODO: later handle here both external, internal data sources (and other like static and sql data source/config) cases, e.g. via composable
// const data_source = toRef(numberWidget.value, 'data_source') as Ref<DataSourceInternal>
// const data_config = toRef(numberWidget.value, 'data_config')

// const reloadWidgetDataEventBus = useEventBus('ReloadWidgetData')

const aggregatedNumberValue = ref<number | undefined>()
const numberColumnTitle = ref<string | undefined>()
const aggregateFunction = ref<string | undefined>()

const dashboardStore = useDashboardStore()
const { reloadWidgetDataEventBus } = dashboardStore
const { openedWidgets: openedDashboardMetaData } = storeToRefs(dashboardStore)

const dataLinkConfigIsMissing = computed(() => {
  const data_source = widgetConfig.value?.data_source as DataSourceInternal
  const data_config = widgetConfig.value?.data_config as DataConfigNumber
  console.log(data_source)
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
  // debugger
  // console.log('entering getData of NumberVisualisation; ', numberWidget.value?.['lastConfigChangeTimestamp'])
  if (
    !widgetConfig.value.id ||
    dataLinkConfigIsMissing.value
    // !data_source?.projectId ||
    // !data_source.tableId ||
    // !data_source.viewId ||
    // !data_config?.aggregateFunction ||
    // !data_config?.colId
  ) {
    console.error('Tried to get data for Number Visualisation without complete data link configuration')
    return
  }
  // TODO switch here and in the BE from columnTitle to columnId (the BE parameters are anyway already named columnId)

  const dashboardData: any = await (
    await api.dashboard.widgetGet(openedDashboardMetaData.value!.dashboardId!, widgetConfig.value.id)
  ).data
  console.log('dashboardData', dashboardData)
  aggregatedNumberValue.value = dashboardData.value
  numberColumnTitle.value = dashboardData.columnName
  aggregateFunction.value = dashboardData.aggregateFunction

  // const aggregateColumnName = `${data_config.aggregateFunction}__${numberColumnTitle.value}`
  // console.log('FOO aggregateColumnName', aggregateColumnName)
  // return dashboardData
  // api.dbViewColumn
  //   .list(data_source.viewId, {
  //     query: {
  //       enrichWithColTitleAndName: 'true',
  //     },
  //   })
  //   .then((response) => response.list)
  // numberColumnTitle.value = columnsOfView.find((colOfView) => colOfView.id === data_config.colId)?.title

  // if (numberColumnTitle.value === undefined) {
  //   console.error('Tried to get data for Number Visualisation without complete data link configuration')
  //   return
  // }

  // const response = await api.dbViewRow.groupedByAggregateByDataList(
  //   'noco',
  //   data_source.projectId,
  //   data_source.tableId,
  //   data_source.viewId,
  //   numberColumnTitle.value,
  //   data_config?.aggregateFunction,
  // )

  // console.log('response', response)
  // // TODO: add better Swagger return type here (so the 'list' TS compiler warning is gone)
  // return response.list[0][`${data_config.aggregateFunction}__${numberColumnTitle.value}`]
}

reloadWidgetDataEventBus.on(async (ev) => {
  if (ev !== widgetConfig.value.id) {
    return
  }
  await getData()
})

onMounted(async () => {
  await getData()
  console.log('onMounted')
  // console.log(JSON.stringify(data_source))
})

watch(
  widgetConfig,
  async () => {
    console.log('watch in NumberVisualisation')
    // console.log(JSON.stringify(data_source))
    // console.log(JSON.stringify(data_config))
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
// {
//   deep: true,
// },
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

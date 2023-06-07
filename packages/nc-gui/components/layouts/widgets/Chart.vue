<script lang="ts" setup>
import { Bar, Line, Pie } from 'vue-chartjs'
import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart as ChartJS,
  Colors,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  LogarithmicScale,
  PieController,
  PointElement,
  PolarAreaController,
  RadarController,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Title,
  Tooltip,
} from 'chart.js'
import { WidgetTypeType } from 'nocodb-sdk'
import type { ChartWidget, DataConfigAggregated2DChart, DataSourceInternal } from 'nocodb-sdk'
import type { Ref } from 'vue'

const props = defineProps<{
  widgetConfig: ChartWidget
}>()

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  BarController,
  BubbleController,
  DoughnutController,
  LineController,
  PieController,
  PolarAreaController,
  RadarController,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  RadialLinearScale,
  TimeScale,
  TimeSeriesScale,
  Filler,
  Legend,
  Title,
  Tooltip,
)
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

ChartJS.register(Colors)

const { api } = useApi()

interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: any[]
  }[]
}
const chartWidget = toRefs(props).widgetConfig
const chartComponent = computed(() => {
  switch (chartWidget.value.widget_type) {
    case WidgetTypeType.BarChart:
      return Bar
    case WidgetTypeType.LineChart:
      return Line
    case WidgetTypeType.PieChart:
      return Pie
    // case WidgetTypeType.ScatterPlot:
    // return Scatter
    default:
      return Bar
  }
})

const dashboardStore = useDashboardStore()
const { openedLayoutSidebarNode } = storeToRefs(dashboardStore)

const chartData = ref<ChartData | undefined>()

const aggregateFunction = ref<string | undefined>()

const { reloadWidgetDataEventBus } = dashboardStore

const dataLinkConfigIsMissing = computed(() => {
  const data_source = chartWidget.value?.data_source as DataSourceInternal
  const data_config = toRef(chartWidget.value, 'data_config') as Ref<DataConfigAggregated2DChart>
  return (
    !data_source ||
    !data_source?.projectId ||
    !data_source?.tableId ||
    !data_source.viewId ||
    !data_config.value.xAxisColId ||
    !(
      (data_config.value.yAxisColId && data_config.value.aggregateFunction) ||
      data_config.value.recordCountOrFieldSummary === 'record_count'
    )
  )
})

const getData = async () => {
  if (!chartWidget.value.id || dataLinkConfigIsMissing.value) {
    console.error('Tried to get data for Chart Visualisation without complete data link configuration')
    return
  }
  const widgetData: any = await (await api.dashboard.widgetGet(openedLayoutSidebarNode.value!.id!, chartWidget.value.id)).data
  if (widgetData == null) {
    console.error('Chart#getData: widgetData null/undefined')
    return
  }
  aggregateFunction.value = widgetData.aggregateFunction
  chartData.value = {
    labels: widgetData.values.map((r: any) => r[widgetData.xColumnName]),
    datasets: [
      {
        label: `${widgetData.yColumnName} (${aggregateFunction.value}) per ${widgetData.xColumnName}`,
        data: widgetData.values.map((r: any) => r[`${widgetData.aggregateFunction}__${widgetData.yColumnName}`]),
      },
    ],
  }
}

reloadWidgetDataEventBus.on(async (ev) => {
  if (ev !== chartWidget.value.id) {
    return
  }
  await getData()
})

onMounted(async () => {
  await getData()
})

watch(
  chartWidget,
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

const chartOptions = {
  responsive: true,
}
</script>

<template>
  <div v-if="dataLinkConfigIsMissing">Missing Data Source Configuration</div>
  <component
    :is="chartComponent"
    v-else-if="chartData"
    :id="`my-chart-id-${widgetConfig.id}`"
    :options="chartOptions"
    :data="chartData"
  />
</template>

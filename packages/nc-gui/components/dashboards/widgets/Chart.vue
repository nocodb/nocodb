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

// const chartColorsSequence = [
//   {
//     borderColor: '#36A2EB',
//     backgroundColor: '#9BD0F5',
//   },
//   {
//     borderColor: '#FF6384',
//     backgroundColor: '#FFB1C1',
//   },

// ]

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

const chartData = ref<ChartData | undefined>()

const aggregateFunction = ref<string | undefined>()

const dashboardStore = useDashboardStore()
const { reloadWidgetDataEventBus } = dashboardStore
const { openedWidgets: openedDashboardMetaData } = storeToRefs(dashboardStore)

const dataLinkConfigIsMissing = computed(() => {
  const data_source = chartWidget.value?.data_source as DataSourceInternal
  const data_config = toRef(chartWidget.value, 'data_config') as Ref<DataConfigAggregated2DChart>
  console.log(data_source)
  return (
    !data_source ||
    !data_source?.projectId ||
    !data_source?.tableId ||
    !data_source.viewId ||
    !data_config.value.xAxisColId ||
    !data_config.value.yAxisColId ||
    !data_config.value.aggregateFunction
  )
})

const getData = async () => {
  if (!chartWidget.value.id || dataLinkConfigIsMissing.value) {
    console.error('Tried to get data for Chart Visualisation without complete data link configuration')
    return
  }
  // TODO switch here and in the BE from columnTitle to columnId (the BE parameters are anyway already named columnId)

  const dashboardData: any = await (
    await api.dashboard.widgetGet(openedDashboardMetaData.value!.dashboardId!, chartWidget.value.id)
  ).data
  console.log('dashboardData', dashboardData)
  aggregateFunction.value = dashboardData.aggregateFunction
  chartData.value = {
    labels: dashboardData.values.map((r: any) => r[dashboardData.xColumnName]),
    datasets: [
      {
        label: `${dashboardData.yColumnName} (${aggregateFunction.value}) per ${dashboardData.xColumnName}`,
        data: dashboardData.values.map((r: any) => r[`${dashboardData.aggregateFunction}__${dashboardData.yColumnName}`]),
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
  console.log('onMounted')
  // console.log(JSON.stringify(data_source))
})

watch(
  chartWidget,
  async () => {
    console.log('watch in ChartVisualisation')
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

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
import type { ChartWidget } from 'nocodb-sdk'
import useLayoutsContextMenu from './useLayoutsContextMenu'

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

const { dataLinkConfigIsMissing } = useWidget(chartWidget)
const { showContextMenuButtonRef, isContextMenuVisible, showContextMenu } = useLayoutsContextMenu()

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
  <h3 class="text-base font-medium text-gray-900 mb-0">{{ widgetConfig.data_config.name }}</h3>
  <div v-if="dataLinkConfigIsMissing">Missing Data Source Configuration</div>
  <button ref="showContextMenuButtonRef" @click="showContextMenu">
    <GeneralIcon icon="threeDotHorizontal" class="text-gray-900 text-xl" />
  </button>
  <LayoutsWidgetsContextMenu v-if="isContextMenuVisible" :widget="widgetConfig" @reload-widget-data="getData" />
  <component
    :is="chartComponent"
    v-else-if="chartData"
    :id="`my-chart-id-${widgetConfig.id}`"
    :options="chartOptions"
    :data="chartData"
  />
</template>

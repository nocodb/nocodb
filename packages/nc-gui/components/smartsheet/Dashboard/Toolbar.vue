<script setup lang="ts">
import { ChartTypes, type WidgetType, WidgetTypes } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { activeDashboard } = storeToRefs(dashboardStore)

const getDefaultConfig = (widgetType: WidgetTypes, type?: ChartTypes) => {
  switch (widgetType) {
    case WidgetTypes.METRIC:
      return {
        dataSource: {
          type: 'model',
          fk_model_id: '',
        },
        metric: {
          aggregation: 'count',
        },
      }
    case WidgetTypes.CHART:
      return {
        chartType: type,
        dataSource: {
          type: 'model',
          fk_model_id: '',
        },
        xAxis: {
          column_id: '',
          label: 'X Axis',
        },
        yAxis: [
          {
            column_id: '',
            aggregation: 'count',
            label: 'Y Axis',
          },
        ],
      }
    case WidgetTypes.TEXT:
      return {
        content: 'Enter your text here...',
        format: 'plain',
      }
    default:
      return {}
  }
}

const createWidget = async (widgetType: WidgetTypes, type?: ChartTypes) => {
  if (!activeDashboard.value?.id) return

  const getWidgetTitle = (widgetType: WidgetTypes, chartType?: ChartTypes) => {
    if (widgetType === WidgetTypes.CHART && chartType) {
      return `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`
    }
    return `${widgetType.charAt(0).toUpperCase() + widgetType.slice(1)}`
  }

  const newWidget: Partial<WidgetType> = {
    title: getWidgetTitle(widgetType, type),
    type: widgetType,
    position: {
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    },
    config: getDefaultConfig(widgetType, type),
  }

  await widgetStore.createWidget(activeDashboard.value.id, newWidget)
}
const addTextWidget = () => createWidget(WidgetTypes.TEXT)
const addNumberWidget = () => createWidget(WidgetTypes.METRIC)
const addBarChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.BAR)
const addLineChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.LINE)
const addPieChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.PIE)
const addDonutChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.DONUT)
const addScatterPlotWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.SCATTER)
</script>

<template>
  <div class="dashboard-toolbar bg-white border-b-1 border-nc-border-gray-medium h-12 p-2 gap-2 flex">
    <NcButton size="small" type="text" @click="addTextWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="cellText" class="w-5 h-5" />
        Text
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addNumberWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <div class="text-nc-content-gray font-bold leading-3.5 px-2 py-1 border-1 border-nc-border-gray-medium rounded-md">
          123
        </div>
        Number
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addBarChartWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartBar" class="w-5 h-5" />
        Bar Chart
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addLineChartWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartLine" class="w-5 h-5" />
        Line Chart
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addPieChartWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartPie" class="w-5 h-5" />
        Pie Chart
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addDonutChartWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartDonut" class="w-5 h-5" />
        Donut
      </div>
    </NcButton>
    <NcButton size="small" type="text" @click="addScatterPlotWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartScatterPlot" class="w-5 h-5" />
        Scatter Plot
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss"></style>

<script setup lang="ts">
import { ChartTypes, type WidgetType, WidgetTypes, getDefaultConfig } from 'nocodb-sdk'
import { calculateNextPosition } from '~/utils/widgetUtils'

const dashboardStore = useDashboardStore()

const widgetStore = useWidgetStore()

const tableStore = useTablesStore()

const { getMeta } = useMetas()

const { activeDashboard } = storeToRefs(dashboardStore)

const { activeDashboardWidgets, selectedWidget } = storeToRefs(widgetStore)

const { activeTables } = storeToRefs(tableStore)

const createWidget = async (widgetType: WidgetTypes, type?: ChartTypes) => {
  if (!activeDashboard.value?.id) return

  const getWidgetTitle = (widgetType: WidgetTypes, chartType?: ChartTypes) => {
    if (widgetType === WidgetTypes.CHART && chartType) {
      return `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`
    }
    return `${widgetType.charAt(0).toUpperCase() + widgetType.slice(1)}`
  }

  const positionMap = {
    [WidgetTypes.METRIC]: {
      x: 0,
      y: 0,
      w: 1,
      h: 2,
    },
    [WidgetTypes.CHART]: {
      x: 0,
      y: 0,
      w: 2,
      h: 5,
    },
  }

  const position = calculateNextPosition(activeDashboardWidgets.value, positionMap[widgetType])

  const modelId = activeTables.value?.[0]?.id

  let meta = null

  if (modelId) {
    meta = await getMeta(modelId)
  }

  const newWidget: Partial<WidgetType> = {
    title: getWidgetTitle(widgetType, type),
    type: widgetType,
    position: { ...positionMap[widgetType], ...position },
    config: getDefaultConfig(widgetType, type, meta?.columns),
    fk_model_id: modelId,
  }

  selectedWidget.value = await widgetStore.createWidget(activeDashboard.value.id, newWidget)
}
// const addTextWidget = () => createWidget(WidgetTypes.TEXT)
const addNumberWidget = () => createWidget(WidgetTypes.METRIC)
// const addBarChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.BAR)
// const addLineChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.LINE)
const addPieChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.PIE)
const addDonutChartWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.DONUT)
// const addScatterPlotWidget = () => createWidget(WidgetTypes.CHART, ChartTypes.SCATTER)
</script>

<template>
  <div class="dashboard-toolbar bg-white border-b-1 border-nc-border-gray-medium h-12 p-2 gap-2 flex">
    <!--    <NcButton size="small" type="text" @click="addTextWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="cellText" class="w-5 h-5" />
        Text
      </div>
    </NcButton> -->
    <NcButton size="small" type="text" @click="addNumberWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <div class="text-nc-content-gray font-bold leading-3.5 px-2 py-1 border-1 border-nc-border-gray-medium rounded-md">
          123
        </div>
        Number
      </div>
    </NcButton>
    <!--
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
    </NcButton> -->
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
    <!--    <NcButton size="small" type="text" @click="addScatterPlotWidget">
      <div class="flex items-center text-nc-content-gray-subtle font-bold leading-5 gap-2">
        <GeneralIcon icon="ncChartScatterPlot" class="w-5 h-5" />
        Scatter Plot
      </div>
    </NcButton> -->
  </div>
</template>

<style scoped lang="scss"></style>

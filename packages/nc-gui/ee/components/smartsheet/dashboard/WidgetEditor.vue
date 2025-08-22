<script setup lang="ts">
import { ChartTypes, type ChartWidgetConfig, WidgetTypes } from 'nocodb-sdk'
import MetricsWidgetConfig from './widgets/metrics/config/index.vue'
import PieChartWidgetConfig from './widgets/piechart/config/index.vue'
import DonutChartWidgetConfig from './widgets/donutchart/config/index.vue'
import BarChartWidgetConfig from './widgets/barchart/config/index.vue'
import TextWidgetConfig from './widgets/text/config/index.vue'
import IframeWidgetConfig from './widgets/iframe/config/index.vue'
const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)

const configComponent = computed(() => {
  if (!selectedWidget.value) return null

  switch (selectedWidget.value.type) {
    case WidgetTypes.METRIC:
      return MetricsWidgetConfig
    case WidgetTypes.TEXT:
      return TextWidgetConfig
    case WidgetTypes.IFRAME:
      return IframeWidgetConfig
    case WidgetTypes.CHART:
      switch ((selectedWidget.value.config as ChartWidgetConfig).chartType) {
        case ChartTypes.PIE:
          return PieChartWidgetConfig
        case ChartTypes.DONUT:
          return DonutChartWidgetConfig
        case ChartTypes.BAR:
          return BarChartWidgetConfig
        default:
          return null
      }
    default:
      return null
  }
})
</script>

<template>
  <div
    v-if="selectedWidget"
    class="widget-editor-panel w-88 bg-white border-l border-nc-content-gray-300 h-full overflow-hidden flex flex-col"
  >
    <component :is="configComponent" :widget="selectedWidget" />
  </div>
</template>

<style scoped lang="scss">
.widget-editor-panel {
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.editor-header {
  min-height: 60px;
}

.editor-footer {
  min-height: 60px;
}
</style>

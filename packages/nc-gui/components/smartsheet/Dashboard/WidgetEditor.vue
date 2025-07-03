<script setup lang="ts">
import { ChartTypes, type ChartWidgetConfig, WidgetTypes } from 'nocodb-sdk'
import MetricsWidgetConfig from './Widgets/Metrics/Config/index.vue'
import PieChartWidgetConfig from './Widgets/PieChart/Config/index.vue'
import DonutChartWidgetConfig from './Widgets/DonutChart/Config.vue'
const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)

const getConfigComponent = () => {
  if (!selectedWidget.value) return null

  switch (selectedWidget.value.type) {
    case WidgetTypes.METRIC:
      return MetricsWidgetConfig
    case WidgetTypes.CHART:
      switch ((selectedWidget.value.config as ChartWidgetConfig).chartType) {
        case ChartTypes.PIE:
          return PieChartWidgetConfig
        case ChartTypes.DONUT:
          return DonutChartWidgetConfig
        default:
          return null
      }
    default:
      return null
  }
}
</script>

<template>
  <div
    v-if="selectedWidget"
    class="widget-editor-panel w-80 bg-white border-l border-nc-content-gray-300 h-full overflow-hidden flex flex-col"
  >
    <component :is="getConfigComponent()" :widget="selectedWidget" />
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

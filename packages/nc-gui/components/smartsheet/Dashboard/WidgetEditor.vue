<script setup lang="ts">
import MetricsWidgetConfig from './Widgets/Metrics/Config/index.vue'
const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)

const getConfigComponent = () => {
  if (!selectedWidget.value) return null

  switch (selectedWidget.value.type) {
    case 'metric':
      return MetricsWidgetConfig
    case 'chart':
      return null
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

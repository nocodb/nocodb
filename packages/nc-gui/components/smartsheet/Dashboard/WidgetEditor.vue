<script setup lang="ts">
import MetricsWidgetConfig from './Widgets/Metrics/Config.vue'
const widgetStore = useWidgetStore()
const dashboardStore = useDashboardStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { activeDashboard } = storeToRefs(dashboardStore)

// Handle config updates
const handleConfigUpdate = async (config: any) => {
  if (selectedWidget.value && activeDashboard.value?.id) {
    await widgetStore.updateWidget(activeDashboard.value.id, selectedWidget.value.id!, { config })
  }
}

// Close editor
const closeEditor = () => {
  selectedWidget.value = null
}

// Get config component based on widget type
const getConfigComponent = () => {
  if (!selectedWidget.value) return null

  switch (selectedWidget.value.type) {
    case 'metric':
      return MetricsWidgetConfig
    case 'chart':
      // Will be implemented later for chart widgets
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
    <component :is="getConfigComponent()" :widget="selectedWidget" @update:config="handleConfigUpdate" />
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

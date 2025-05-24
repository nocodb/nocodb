<script setup lang="ts">
import { type WidgetType, WidgetTypes } from 'nocodb-sdk'

interface Props {
  widget?: WidgetType
  isReadonly?: boolean
}

interface Emits {
  (e: 'edit', widget: WidgetType): void
  (e: 'delete', widget: WidgetType): void
}

const props = withDefaults(defineProps<Props>(), {
  isReadonly: false,
})

defineEmits<Emits>()

// Widget type to component mapping
const getWidgetComponent = (type?: WidgetTypes) => {
  switch (type) {
    case WidgetTypes.CHART:
      return resolveComponent('SmartsheetDashboardWidgetChart')
    case WidgetTypes.TABLE:
      return resolveComponent('SmartsheetDashboardWidgetTable')
    case WidgetTypes.METRIC:
      return resolveComponent('SmartsheetDashboardWidgetMetric')
    case WidgetTypes.TEXT:
      return resolveComponent('SmartsheetDashboardWidgetText')
    case WidgetTypes.IFRAME:
      return resolveComponent('SmartsheetDashboardWidgetIframe')
    default:
      return resolveComponent('SmartsheetDashboardWidgetPlaceholder')
  }
}

// Widget type to icon mapping
const getWidgetIcon = (type?: WidgetTypes) => {
  switch (type) {
    case WidgetTypes.CHART:
      return 'ncBarChart2'
    case WidgetTypes.TABLE:
      return 'layout'
    case WidgetTypes.METRIC:
      return 'ncAnalytics'
    case WidgetTypes.TEXT:
      return 'ncTextFormat'
    case WidgetTypes.IFRAME:
      return 'ncWeb'
    default:
      return 'ncWidgets'
  }
}
</script>

<template>
  <div class="dashboard-widget-container" :class="{ readonly: isReadonly }">
    <!-- Widget Header -->
    <div class="widget-header">
      <div class="flex items-center flex-1 min-w-0">
        <GeneralIcon :icon="getWidgetIcon(widget?.type)" class="widget-icon" />
        <h3 class="widget-title" :title="widget?.title">{{ widget?.title }}</h3>
      </div>

      <div v-if="!isReadonly" class="widget-actions">
        <NcTooltip>
          <template #title>Edit Widget</template>
          <NcButton size="small" type="text" @click="$emit('edit', widget)">
            <MaterialSymbolsEdit class="w-4 h-4" />
          </NcButton>
        </NcTooltip>

        <NcTooltip>
          <template #title>Delete Widget</template>
          <NcButton size="small" type="text" class="text-red-500 hover:text-red-600" @click="$emit('delete', widget)"> </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Widget Content -->
    <div class="widget-content">
      <div v-if="!widget" class="widget-placeholder">
        <p class="text-gray-500 text-sm mt-2">Widget not found</p>
      </div>

      <component
        :is="getWidgetComponent(widget.type)"
        v-else
        :widget="widget"
        :config="widget.config"
        :is-readonly="isReadonly"
      />
    </div>

    <!-- Widget Description (if exists) -->
    <div v-if="widget?.description" class="widget-description">
      <p class="text-xs text-gray-600">{{ widget.description }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-widget-container {
  @apply w-full h-full flex flex-col bg-white rounded-lg overflow-hidden;
  border: 1px solid rgb(229, 231, 235);
}

.widget-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50;
  min-height: 56px;
}

.widget-icon {
  @apply w-5 h-5 text-gray-600 mr-2 flex-shrink-0;
}

.widget-title {
  @apply text-sm font-medium text-gray-900 truncate;
}

.widget-actions {
  @apply flex items-center gap-1;
}

.widget-content {
  @apply flex-1 p-4 overflow-hidden;
  min-height: 0; // Important for proper flex behavior
}

.widget-description {
  @apply px-4 py-2 border-t border-gray-100 bg-gray-50;
}

.widget-placeholder {
  @apply w-full h-full flex flex-col items-center justify-center text-center;
}

.readonly {
  .widget-header {
    @apply pr-4;
  }
}

// Ensure proper sizing for widget content
:deep(.widget-content > *) {
  @apply w-full h-full;
}
</style>

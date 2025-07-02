<script setup lang="ts">
import type { WidgetType } from 'nocodb-sdk'
import MetricWidget from './Widgets/Metrics/index.vue'
// Stores
const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { isEditingDashboard } = storeToRefs(dashboardStore)
const { activeDashboardWidgets, selectedWidget } = storeToRefs(widgetStore)

// Convert widgets to grid layout items
const layout = computed({
  get: () => {
    return activeDashboardWidgets.value.map((widget) => ({
      x: widget.position?.x || 0,
      y: widget.position?.y || 0,
      w: widget.position?.w || 2,
      h: widget.position?.h || 2,
      i: widget.id!,
    }))
  },
  set: (newLayout) => {
    // Update widget positions when layout changes
    newLayout.forEach((item) => {
      const widget = activeDashboardWidgets.value.find((w) => w.id === item.i)
      if (widget && dashboardStore.activeDashboard?.id) {
        widgetStore.updateWidgetPosition(dashboardStore.activeDashboard.id, item.i, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })
      }
    })
  },
})

// Handle widget selection
const handleWidgetClick = (widget: WidgetType) => {
  if (isEditingDashboard.value) {
    selectedWidget.value = widget
  }
}

// Render widget component based on type
const getWidgetComponent = (widget: WidgetType) => {
  switch (widget.type) {
    case 'metric':
      return MetricWidget
    case 'chart':
      // Will be implemented later for chart widgets
      return 'div'
    default:
      return 'div'
  }
}
</script>

<template>
  <div
    class="bg-white w-full overflow-y-scroll h-full rounded-lg p-4"
    style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.12)"
    @click="selectedWidget = null"
  >
    <GridLayout
      v-model:layout="layout"
      :col-num="4"
      :row-height="200"
      :is-draggable="isEditingDashboard"
      :is-resizable="isEditingDashboard"
      :vertical-compact="false"
      use-css-transforms
    >
      <template #item="{ item }">
        <div
          class="widget-container h-full w-full"
          :class="{
            'cursor-pointer': isEditingDashboard,
            'selected': selectedWidget?.id === item.i,
          }"
          @click.stop="
            () => {
              const widget = activeDashboardWidgets.find((w) => w.id === item.i)
              if (widget) handleWidgetClick(widget)
            }
          "
        >
          <component
            :is="getWidgetComponent(activeDashboardWidgets.find(w => w.id === item.i)!)"
            :widget="activeDashboardWidgets.find(w => w.id === item.i)!"
            :is-editing="isEditingDashboard"
          />
        </div>
      </template>
    </GridLayout>

    <!-- Empty state when no widgets -->
    <div
      v-if="activeDashboardWidgets.length === 0"
      class="empty-state flex flex-col items-center justify-center h-64 text-nc-content-gray-500"
    >
      <GeneralIcon icon="dashboard" class="w-12 h-12 mb-4" />
      <h3 class="text-lg font-medium mb-2">No widgets yet</h3>
      <p class="text-sm text-center">Start building your dashboard by adding widgets from the toolbar above.</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.vgl-layout {
  --vgl-placeholder-bg: var(--nc-background-brand);
}

:deep(.vgl-item--placeholder) {
  @apply border-2 border-nc-content-brand rounded-xl opacity-100;
}

:deep(.vgl-item:not(.vgl-item--placeholder)) {
  @apply border-1 border-nc-content-gray-medium rounded-xl overflow-hidden;
}

:deep(.vgl-item--resizing) {
  box-shadow: 0px 0px 4px 4px rgba(0, 0, 0, 0.04);
}

:deep(.vgl-item--dragging) {
  box-shadow: 0px 0px 4px 4px rgba(0, 0, 0, 0.04);
}

:deep(.vgl-item--static) {
  background-color: #f5f5f5;
}

.widget-container {
  transition: all 0.2s ease;

  &.selected {
    box-shadow: 0 0 0 2px var(--nc-content-brand);
  }

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.empty-state {
  border: 2px dashed var(--nc-content-gray-300);
  border-radius: 12px;
  margin: 2rem 0;
}
</style>

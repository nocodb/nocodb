<script setup lang="ts">
import { ChartTypes, type ChartWidgetConfig, type WidgetType, WidgetTypes } from 'nocodb-sdk'
import MetricWidget from './Widgets/Metrics/index.vue'
import DonutChartWidget from './Widgets/DonutChart/index.vue'
import PieChartWidget from './Widgets/PieChart/index.vue'
import PlaceholderImage from '~/assets/img/dashboards/placeholder.svg'
// Stores
const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { isEditingDashboard } = storeToRefs(dashboardStore)
const { activeDashboardWidgets, selectedWidget } = storeToRefs(widgetStore)

const layout = computed(() => {
  return activeDashboardWidgets.value.map((widget) => ({
    x: widget.position?.x || 0,
    y: widget.position?.y || 0,
    w: widget.position?.w || 2,
    h: widget.position?.h || 2,
    i: widget.id!,
  }))
})

const handleWidgetClick = (widget: WidgetType) => {
  if (isEditingDashboard.value) {
    selectedWidget.value = widget
  }
}

const getWidgetComponent = (widget: WidgetType) => {
  switch (widget.type) {
    case WidgetTypes.METRIC:
      return MetricWidget
    case WidgetTypes.CHART:
      switch ((widget.config as ChartWidgetConfig).chartType) {
        case ChartTypes.PIE:
          return PieChartWidget
        case ChartTypes.DONUT:
          return DonutChartWidget
      }
      return 'div'
    default:
      return 'div'
  }
}

const handleMove = (i: string, newX: number, newY: number) => {
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  if (widget) {
    widgetStore.updateWidget(
      dashboardStore.activeDashboardId,
      i,
      {
        position: {
          ...widget.position,
          x: newX,
          y: newY,
        },
      },
      { skipNetworkCall: true },
    )
  }
}

const handleMoved = (i: string, newX: number, newY: number) => {
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  if (widget) {
    widgetStore.updateWidgetPosition(dashboardStore.activeDashboardId, i, {
      ...widget.position,
      x: newX,
      y: newY,
    })
  }
}

const handleResize = (i: string, newH: number, newW: number) => {
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  if (widget) {
    widgetStore.updateWidget(
      dashboardStore.activeDashboard.id,
      i,
      {
        position: {
          ...widget.position,
          w: newW,
          h: newH,
        },
      },
      { skipNetworkCall: true },
    )
  }
}

const handleResized = (i: string, newH: number, newW: number) => {
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  if (widget) {
    widgetStore.updateWidgetPosition(dashboardStore.activeDashboard.id, i, {
      ...widget.position,
      w: newW,
      h: newH,
    })
  }
}
</script>

<template>
  <div
    class="bg-white w-full overflow-y-scroll h-full rounded-lg p-4"
    style="box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.12)"
    :class="{
      'flex flex-col items-center justify-center': !activeDashboardWidgets.length,
    }"
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
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        @move="(i, x, y) => handleMove(i, x, y)"
        @moved="(i, x, y) => handleMoved(i, x, y)"
        @resize="(i, h, w) => handleResize(i, h, w)"
        @resized="(i, h, w) => handleResized(i, h, w)"
      >
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
      </GridItem>
    </GridLayout>
    <div
      v-if="!activeDashboardWidgets.length && !isEditingDashboard"
      class="empty-state flex flex-col h-full items-center justify-center h-64 text-nc-content-gray-500"
    >
      <img :src="PlaceholderImage" class="w-120 mb-4" alt="Start building your dashboard" />
      <h3 class="text-lg font-medium mb-2">Get started with Dashboards</h3>
      <p class="text-sm text-center">Start building your dashboard by adding widgets from the widget bar.</p>
      <NcButton @click="dashboardStore.isEditingDashboard = true">Edit Dashboard</NcButton>
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

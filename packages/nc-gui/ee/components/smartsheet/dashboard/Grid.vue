<script setup lang="ts">
import { ChartTypes, type ChartWidgetConfig, type WidgetType, WidgetTypes } from 'nocodb-sdk'
import MetricWidget from './widgets/metrics/index.vue'
import DonutChartWidget from './widgets/donutchart/index.vue'
import PieChartWidget from './widgets/piechart/index.vue'
import PlaceholderImage from '~/assets/img/dashboards/placeholder.svg'

const dashboardStore = useDashboardStore()
const widgetStore = useWidgetStore()

const { isEditingDashboard, activeDashboardId } = storeToRefs(dashboardStore)
const { activeDashboardWidgets, selectedWidget } = storeToRefs(widgetStore)

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

// Track drag/resize state
const isDragging = ref(false)
const isResizing = ref(false)

const windowSize = useWindowSize()

const isResponsiveEnabled = computed(() => {
  return !isEditingDashboard.value && windowSize.width.value < 1280
})

const responsive = ref()

const layout = computed({
  set: (value) => {
    responsive.value = value
  },
  get: () => {
    if (isResponsiveEnabled.value) {
      return responsive.value || []
    }
    return activeDashboardWidgets.value.map((widget) => ({
      x: widget.position?.x,
      y: widget.position?.y,
      w: widget.position?.w,
      h: widget.position?.h,
      i: widget.id!,
    }))
  },
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
  if (isPublic.value) return
  isDragging.value = true
  const layoutItem = layout.value.find((item) => item.i === i)
  if (layoutItem) {
    layoutItem.x = newX
    layoutItem.y = newY
  }
}

const handleMoved = (i: string, newX: number, newY: number) => {
  if (isPublic.value) return
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  layout.value = layout.value.map((item) => {
    if (item.i === i) {
      return {
        ...item,
        x: newX,
        y: newY,
      }
    }
    return item
  })
  if (widget) {
    widgetStore.updateWidgetPosition(activeDashboardId.value, i, {
      ...widget.position!,
      x: newX,
      y: newY,
    })
  }

  // Reset drag state after a small delay to prevent click
  setTimeout(() => {
    isDragging.value = false
  }, 50)
}

const handleResize = (i: string, newH: number, newW: number) => {
  if (isPublic.value) return
  isResizing.value = true
  const layoutItem = layout.value.find((item) => item.i === i)
  if (layoutItem) {
    layoutItem.w = newW
    layoutItem.h = newH
  }
}

const handleResized = (i: string, newH: number, newW: number) => {
  if (isPublic.value) return
  const widget = activeDashboardWidgets.value.find((w) => w.id === i)
  layout.value = layout.value.map((item) => {
    if (item.i === i) {
      return {
        ...item,
        w: newW,
        h: newH,
      }
    }
    return item
  })
  if (widget) {
    widgetStore.updateWidgetPosition(activeDashboardId.value, i, {
      ...widget.position!,
      w: newW,
      h: newH,
    })
  }

  // Reset resize state after a small delay to prevent click
  setTimeout(() => {
    isResizing.value = false
  }, 50)
}

const onWidgetClick = (item: string) => {
  if (isPublic.value) return
  // Prevent click if currently dragging or resizing
  if ((isDragging.value || isResizing.value) && !selectedWidget.value) {
    return
  }

  const widget = activeDashboardWidgets.value.find((w) => w.id === item)
  if (widget && isEditingDashboard.value) handleWidgetClick(widget)
}

const getWidgetPositionConfig = (item: string) => {
  const widget = activeDashboardWidgets.value.find((w) => w.id === item)

  if (!widget) return {}

  switch (widget.type) {
    case WidgetTypes.METRIC: {
      return {
        minW: 1,
        minH: 2,
        maxW: 4,
        maxH: 2,
      }
    }
    case WidgetTypes.CHART: {
      return {
        minW: 2,
        minH: 5,
        maxW: 2,
        maxH: 6,
      }
    }
    default:
      return {}
  }
}

const gridRef = ref()

watch(
  activeDashboardWidgets,
  () => {
    responsive.value = activeDashboardWidgets.value.map((widget) => ({
      x: widget.position?.x,
      y: widget.position?.y,
      w: widget.position?.w,
      h: widget.position?.h,
      i: widget.id!,
    }))
  },
  { immediate: true, deep: true },
)
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
      ref="gridRef"
      v-model:layout="layout"
      :row-height="80"
      :col-num="isResponsiveEnabled ? null : 4"
      :responsive="isResponsiveEnabled"
      :cols="{ lg: 4, md: 3, sm: 2, xs: 1, xxs: 1 }"
      :is-draggable="isEditingDashboard && !isPublic"
      :is-resizable="isEditingDashboard && !isPublic"
      :vertical-compact="false"
      :use-css-transforms="true"
    >
      <GridItem
        v-for="item in layout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        v-bind="getWidgetPositionConfig(item.i)"
        @move="handleMove"
        @moved="handleMoved"
        @resize="handleResize"
        @resized="handleResized"
      >
        <div
          class="widget-container h-full w-full"
          :class="{
            'cursor-pointer': isEditingDashboard && !isDragging && !isResizing,
            'cursor-move': isDragging,
            'cursor-nw-resize': isResizing,
          }"
          @click.stop="onWidgetClick(item.i)"
        >
          <component
            :is="getWidgetComponent(activeDashboardWidgets.find(w => w.id === item.i)!)"
            class="nc-widget"
            :class="{
              selected: selectedWidget?.id === item.i,
              error: selectedWidget?.id === item.i && selectedWidget?.error,
            }"
            :widget="activeDashboardWidgets.find(w => w.id === item.i)!"
            :is-editing="isEditingDashboard"
          />
        </div>
      </GridItem>
    </GridLayout>
    <div
      v-if="!activeDashboardWidgets.length && !isEditingDashboard && !isPublic && isUIAllowed('dashboardEdit')"
      class="empty-state flex flex-col h-full items-center justify-center h-64 text-nc-content-gray-500"
    >
      <img :src="PlaceholderImage" class="w-120 mb-4" alt="Start building your dashboard" />
      <h3 class="text-lg font-medium mb-2">Get started with Dashboards</h3>
      <p class="text-sm text-center">Start building your dashboard by adding widgets from the widget bar.</p>
      <NcButton @click="dashboardStore.isEditingDashboard = true">Edit Dashboard</NcButton>
    </div>
    <div
      v-if="(isPublic || !isUIAllowed('dashboardEdit')) && !activeDashboardWidgets.length"
      class="empty-state flex flex-col h-full items-center justify-center h-full text-nc-content-gray-500"
    >
      <img src="~assets/img/placeholder/no-search-result-found.png" class="w-120 mb-4" alt="Dashboard is empty" />
      <h3 class="text-lg font-medium mb-2">This dashboard is empty</h3>
      <p class="text-sm text-center">Ask the owner to add widgets to this dashboard</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
.vgl-layout {
  --vgl-placeholder-bg: var(--nc-bg-brand);
}

:deep(.vgl-item--placeholder) {
  @apply border-2 border-nc-content-brand rounded-xl opacity-100;
}
:deep(.vgl-item:not(.vgl-item--placeholder)) {
  @apply border-1 border-nc-content-gray-medium !rounded-xl;
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

:deep(.vgl-item__resizer) {
  @apply opacity-0;
}
.empty-state {
  border: 2px dashed var(--nc-content-gray-300);
  border-radius: 12px;
  margin: 2rem 0;
}
</style>

<style lang="scss">
.nc-widget {
  &.selected:not(.error) {
    @apply ring-2 ring-nc-fill-primary;
  }

  &.error {
    @apply ring-2 ring-nc-fill-warning-hover;
  }
}
</style>

<script setup lang="ts">
import type { WidgetType } from 'nocodb-sdk'
import { GridItem, GridLayout } from 'vue3-grid-layout-next'

interface Props {
  widgets: WidgetType[]
  isLoading?: boolean
  isReadonly?: boolean
}

interface Emits {
  (e: 'add-widget'): void
  (e: 'layout-changed', layout: any[]): void
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isReadonly: false,
})

const emit = defineEmits<Emits>()

const widgetStore = useWidgetStore()

// Convert widgets to grid layout format
const gridLayout = computed({
  get() {
    return props.widgets.map((widget) => ({
      x: widget.position?.x || 0,
      y: widget.position?.y || 0,
      w: widget.position?.w || 4,
      h: widget.position?.h || 3,
      i: widget.id!,
    }))
  },
  set(newLayout) {
    // Update is handled by onLayoutUpdate
  },
})

// Helper to get widget by ID
const getWidgetById = (id: string) => {
  return props.widgets.find((widget) => widget.id === id)
}

// Handle layout updates
const onLayoutUpdate = async (layout: any[]) => {
  const dashboardId = useDashboardStore().activeDashboardId
  if (!dashboardId) return

  // Update widget positions
  for (const item of layout) {
    const widget = getWidgetById(item.i)
    if (widget) {
      await widgetStore.updateWidgetPosition(dashboardId, item.i, {
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      })
    }
  }

  emit('layout-changed', layout)
}

// Handle widget deletion
const deleteWidget = async (widget: WidgetType) => {
  const dashboardId = useDashboardStore().activeDashboardId
  if (!dashboardId || !widget.id) return

  await widgetStore.deleteWidget(dashboardId, widget.id)
}

// Handle widget editing
const editWidget = (widget: WidgetType) => {
  // TODO: Open widget edit modal
  console.log('Edit widget:', widget)
}
</script>

<template>
  <div class="dashboard-grid-container">
    <GridLayout
      v-model:layout="gridLayout"
      :col-num="12"
      :row-height="60"
      :is-draggable="!isReadonly"
      :is-resizable="!isReadonly"
      :is-mirrored="false"
      :vertical-compact="true"
      :margin="[10, 10]"
      :use-css-transforms="true"
      @layout-updated="onLayoutUpdate"
    >
      <GridItem
        v-for="item in gridLayout"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        :min-w="2"
        :min-h="2"
        class="grid-item"
      >
        <SmartsheetDashboardWidget
          :widget="getWidgetById(item.i)"
          :is-readonly="isReadonly"
          @delete="deleteWidget"
          @edit="editWidget"
        />
      </GridItem>
    </GridLayout>

    <!-- Empty state -->
    <div v-if="!widgets.length && !isLoading" class="empty-dashboard">
      <div class="flex flex-col items-center justify-center h-full text-gray-500">
        <MaterialSymbolsWidgetsOutlineRounded class="text-6xl mb-4" />
        <h3 class="text-lg font-medium mb-2">No widgets added yet</h3>
        <p class="text-sm mb-4">Add your first widget to get started</p>
        <NcButton v-if="!isReadonly" type="primary" @click="$emit('add-widget')">
          <template #icon>
            <MaterialSymbolsAdd />
          </template>
          Add Widget
        </NcButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="loading-dashboard">
      <div class="flex items-center justify-center h-full">
        <a-spin size="large" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dashboard-grid-container {
  @apply w-full h-full relative;
  min-height: 500px;
}

.grid-item {
  @apply border border-gray-200 rounded-lg bg-white shadow-sm;
  transition: all 0.2s ease;

  &:hover {
    @apply shadow-md;
  }
}

.empty-dashboard,
.loading-dashboard {
  @apply absolute inset-0 flex items-center justify-center;
  min-height: 400px;
}

.empty-dashboard {
  @apply bg-gray-50 rounded-lg border-2 border-dashed border-gray-300;
}

// Vue Grid Layout styles
:deep(.vue-grid-layout) {
  background: transparent;
}

:deep(.vue-grid-item) {
  touch-action: none;
}

:deep(.vue-grid-item.no-touch) {
  touch-action: none;
}

:deep(.vue-grid-item.css-transforms) {
  transition: all 200ms ease;
}

:deep(.vue-grid-item.resizing) {
  opacity: 0.6;
  z-index: 3;
}

:deep(.vue-grid-item.vue-draggable-dragging) {
  transition: none;
  z-index: 3;
  opacity: 0.8;
}

:deep(.vue-grid-item > .vue-resizable-handle) {
  position: absolute;
  width: 20px;
  height: 20px;
  bottom: 0;
  right: 0;
  background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNiIgaGVpZ2h0PSI2IiB2aWV3Qm94PSIwIDAgNiA2IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGZpbGw9IiM4OTkiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PHBhdGggZD0iTTYgMHY2SDAvIi8+PC9nPjwvc3ZnPg==');
  background-position: bottom right;
  padding: 0 3px 3px 0;
  background-repeat: no-repeat;
  background-origin: content-box;
  box-sizing: border-box;
  cursor: se-resize;
  opacity: 0;
  transition: opacity 0.2s;
}

:deep(.vue-grid-item:hover > .vue-resizable-handle) {
  opacity: 1;
}
</style>

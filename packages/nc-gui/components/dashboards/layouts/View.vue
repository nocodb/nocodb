<script lang="ts" setup>
import type { RendererElement, RendererNode, VNode } from 'vue'
import { WidgetTypeType } from 'nocodb-sdk'
import { useDashboardStore } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const { openedWidgets, focusedWidget, openedLayoutSidebarNode } = storeToRefs(dashboardStore)
const {
  updatePositionOfWidgetById,
  updateScreenDimensionsOfWidgetById,
  addWidget,
  removeWidgetById,
  resetFocus,
  updateFocusedWidgetByElementId,
} = dashboardStore

const widgetsLibrary: WidgetMeta[] = [
  {
    title: 'Text',
    icon: iconMap.text,
    type: WidgetTypeType.StaticText,
  },
  {
    title: 'Number',
    icon: iconMap.number,
    type: WidgetTypeType.Number,
  },
  {
    title: 'Button',
    icon: iconMap.plus,
    type: WidgetTypeType.Button,
  },
]
const dataVisualisationsLibrary: WidgetMeta[] = [
  {
    title: 'Bar',
    icon: iconMap.text,
    type: WidgetTypeType.BarChart,
  },
  {
    title: 'Line',
    icon: iconMap.number,
    type: WidgetTypeType.LineChart,
  },
  {
    title: 'Pie',
    icon: iconMap.plus,
    type: WidgetTypeType.PieChart,
  },
  {
    title: 'Scatter',
    icon: iconMap.plus,
    type: WidgetTypeType.ScatterPlot,
  },
]
interface WidgetMeta {
  title: string
  icon: VNode<
    RendererNode,
    RendererElement,
    {
      [key: string]: any
    }
  >
  type: WidgetTypeType
}
</script>

<template>
  <a-layout class="app-container">
    <a-layout-sider class="left-sidebar flex" width="18rem" theme="light">
      <!-- Sidebar content here -->
      <h2>{{ openedLayoutSidebarNode?.title }}</h2>
      <h3>Widgets</h3>
      <a-input placeholder="Search Widget" />
      <a-divider />
      <div>
        <h4>Dashboard Elements</h4>
        <a-list :grid="{ gutter: 10, column: 3 }" :data-source="widgetsLibrary">
          <template #renderItem="{ item }">
            <a-list-item>
              <button class="nc-widget-template" @click="addWidget(item.type)">
                <div>
                  <component :is="item.icon" class="text-grey" />
                  <span class="ml-2">{{ item.title }}</span>
                </div>
              </button>
            </a-list-item>
          </template>
        </a-list>
      </div>
      <a-divider />
      <div>
        <h4>Data Visualisations</h4>
        <a-list :grid="{ gutter: 10, column: 3 }" :data-source="dataVisualisationsLibrary">
          <template #renderItem="{ item }">
            <a-list-item>
              <button class="nc-widget-template" @click="addWidget(item.type)">
                <div>
                  <component :is="item.icon" class="text-grey" />
                  <span class="ml-2">{{ item.title }}</span>
                </div>
              </button>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </a-layout-sider>
    <a-layout-content ref="mainArea" class="main-area" :min-width="200" @click="resetFocus">
      <div>
        <template v-for="widget in openedWidgets" :key="widget.id">
          <DashboardsLayoutsDraggableResizableContainer
            :has-focus="widget.id === focusedWidget?.id"
            :screen-position="widget.appearance_config.screenPosition"
            :screen-dimensions="widget.appearance_config.screenDimensions"
            @set-focus="updateFocusedWidgetByElementId(widget.id)"
            @update-position="updatePositionOfWidgetById(widget.id, $event.newPosition)"
            @update-screen-dimensions="updateScreenDimensionsOfWidgetById(widget.id, $event.newScreenDimensions)"
            @remove="removeWidgetById(widget.id)"
          >
            <DashboardsWidgetsWidget :widget="widget" />
          </DashboardsLayoutsDraggableResizableContainer>
        </template>
      </div>
    </a-layout-content>
    <!-- TODO: decide / change again to rem for width and overall: use consistent styling -->
    <a-layout-sider class="right-sidebar flex" width="500px" theme="light">
      <DashboardsLayoutsWidgetsPropertiesPanel />
    </a-layout-sider>
  </a-layout>
</template>

<style>
.app-container {
  height: 100vh;
  overflow: hidden;
}

.left-sidebar,
.right-sidebar {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  border-right: 1px solid #ccc;
}

.left-sidebar {
  border-right: 1px solid #ccc;
  @apply flex;
}

.right-sidebar {
  border-left: 1px solid #ccc;
}

.main-area {
  height: 100%;
  overflow: auto;
  padding: 1rem;
}

.nc-widget-template {
  @apply w-18;
  @apply h-18;
  @apply border;
  @apply border-solid;
  @apply border-grey-light;
  @apply rounded;
  @apply text-sm;
  @apply text-grey;
  @apply cursor-pointer;
  @apply hover:bg-grey-lightest;
  @apply hover:border-grey;
  div {
    @apply flex;
    @apply items-center;
    @apply justify-center;
    @apply flex-col;
  }
}
</style>

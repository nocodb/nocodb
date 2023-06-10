<script setup lang="ts">
import { WidgetTypeType } from 'nocodb-sdk'
import type { WidgetTemplate } from '../types'

import TextWidgetIcon from './custom-icons/widget-types/Text.vue'
import NumberWidgetIcon from './custom-icons/widget-types/Number.vue'
import DividerWidgetIcon from './custom-icons/widget-types/Divider.vue'
import ButtonWidgetIcon from './custom-icons/widget-types/Button.vue'
import ImageWidgetIcon from './custom-icons/widget-types/Image.vue'
import BarChartWidgetIcon from './custom-icons/widget-types/BarChart.vue'
import LineChartWidgetIcon from './custom-icons/widget-types/LineChart.vue'
import PieChartWidgetIcon from './custom-icons/widget-types/PieChart.vue'
import ScatterChartWidgetIcon from './custom-icons/widget-types/ScatterChart.vue'

const widgetsLibrary: WidgetTemplate[] = [
  {
    title: 'Text',
    icon: TextWidgetIcon,
    type: WidgetTypeType.StaticText,
  },
  {
    title: 'Number',
    icon: NumberWidgetIcon,
    type: WidgetTypeType.Number,
  },
  {
    title: 'Divider',
    icon: DividerWidgetIcon,
    type: WidgetTypeType.Divider,
  },
  {
    title: 'Button',
    icon: ButtonWidgetIcon,
    type: WidgetTypeType.Button,
  },
  {
    title: 'Image',
    icon: ImageWidgetIcon,
    type: WidgetTypeType.Image,
  },
]
const dataVisualisationsLibrary: WidgetTemplate[] = [
  {
    title: 'Bar',
    icon: BarChartWidgetIcon,
    type: WidgetTypeType.BarChart,
  },
  {
    title: 'Line',
    icon: LineChartWidgetIcon,
    type: WidgetTypeType.LineChart,
  },
  {
    title: 'Pie',
    icon: PieChartWidgetIcon,
    type: WidgetTypeType.PieChart,
  },
  {
    title: 'Scatter',
    icon: ScatterChartWidgetIcon,
    type: WidgetTypeType.ScatterPlot,
  },
]
</script>

<template>
  <div class="p-4 w-[320px]">
    <h3 class="uppercase text-xs text-gray-500">Widgets Panel</h3>
    <a-divider />
    <div>
      <h4>Dashboard Elements</h4>
      <a-list :grid="{ gutter: 10, column: 3 }" :data-source="widgetsLibrary">
        <template #renderItem="{ item }">
          <a-list-item>
            <LayoutsWidgetsLibraryPanelWidgetTemplateButton :item="item" />
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
            <LayoutsWidgetsLibraryPanelWidgetTemplateButton :item="item" />
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>

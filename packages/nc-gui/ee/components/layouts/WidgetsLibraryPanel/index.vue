<script setup lang="ts">
import { WidgetTypeType } from 'nocodb-sdk'

import TextWidgetIcon from './custom-icons/widget-types/Text.vue'
import NumberWidgetIcon from './custom-icons/widget-types/Number.vue'
import DividerWidgetIcon from './custom-icons/widget-types/Divider.vue'
import ButtonWidgetIcon from './custom-icons/widget-types/Button.vue'
import BarChartWidgetIcon from './custom-icons/widget-types/BarChart.vue'
import LineChartWidgetIcon from './custom-icons/widget-types/LineChart.vue'
import PieChartWidgetIcon from './custom-icons/widget-types/PieChart.vue'
import ScatterChartWidgetIcon from './custom-icons/widget-types/ScatterChart.vue'

import type { WidgetTemplate } from '#imports'

const widgetsLibrary: WidgetTemplate[] = [
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
  {
    title: 'Text',
    icon: TextWidgetIcon,
    type: WidgetTypeType.StaticText,
  },
  {
    title: 'Button',
    icon: ButtonWidgetIcon,
    type: WidgetTypeType.Button,
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
]
</script>

<template>
  <div class="p-4 w-[230px]">
    <h3 class="uppercase text-md text-gray-500">Widgets</h3>
    <a-divider />
    <div>
      <a-list :grid="{ gutter: 1, column: 2 }" :data-source="widgetsLibrary">
        <template #renderItem="{ item }">
          <a-list-item>
            <LayoutsWidgetsLibraryPanelWidgetTemplateButton :item="item" />
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>

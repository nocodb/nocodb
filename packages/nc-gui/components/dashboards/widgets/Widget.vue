<script lang="ts" setup>
import type { Widget } from 'nocodb-sdk'
import { ButtonWidget, ChartWidget, NumberWidget, StaticTextWidget, WidgetTypeType, chartTypes } from 'nocodb-sdk'

const props = defineProps<{
  widget: Widget
}>()

const isChart = computed(() => chartTypes.includes(props.widget.widget_type))
const isNumber = computed(() => props.widget.widget_type === WidgetTypeType.Number)
const isStaticText = computed(() => props.widget.widget_type === WidgetTypeType.StaticText)
const isButton = computed(() => props.widget.widget_type === WidgetTypeType.Button)
</script>

<template>
  <DashboardsWidgetsChart v-if="isChart" :widget-config="widget as ChartWidget" />
  <DashboardsWidgetsNumber v-else-if="isNumber" :widget-config="widget as NumberWidget" />
  <DashboardsWidgetsText v-else-if="isStaticText" :widget-config="widget as StaticTextWidget" />
  <DashboardsWidgetsButton v-else-if="isButton" :widget-config="widget as ButtonWidget" />
  <div v-else>Visualisation Type '{{ widget.widget_type }}' not yet implemented</div>
</template>

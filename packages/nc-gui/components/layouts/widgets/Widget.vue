<script lang="ts" setup>
import type { Widget } from 'nocodb-sdk'
import { ButtonWidget, ChartWidget, NumberWidget, StaticTextWidget, WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed } from '#imports'

const props = defineProps<{
  widget: Widget
}>()

const isChart = computed(() => chartTypes.includes(props.widget.widget_type))
const isNumber = computed(() => props.widget.widget_type === WidgetTypeType.Number)
const isStaticText = computed(() => props.widget.widget_type === WidgetTypeType.StaticText)
const isButton = computed(() => props.widget.widget_type === WidgetTypeType.Button)
</script>

<template>
  <LayoutsWidgetsChart v-if="isChart" :widget-config="widget as ChartWidget" />
  <LayoutsWidgetsNumber v-else-if="isNumber" :widget-config="widget as NumberWidget" />
  <LayoutsWidgetsText v-else-if="isStaticText" :widget-config="widget as StaticTextWidget" />
  <LayoutsWidgetsButton v-else-if="isButton" :widget-config="widget as ButtonWidget" />
  <div v-else>Visualisation Type '{{ widget.widget_type }}' not yet implemented</div>
</template>

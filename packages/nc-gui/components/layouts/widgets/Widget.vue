<script lang="ts" setup>
import type { Widget } from 'nocodb-sdk'
import { ButtonWidget, ChartWidget, NumberWidget, StaticTextWidget, WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed } from '#imports'

const props = defineProps<{
  widgetId: string
}>()

const dashboardStore = useDashboardStore()
const { openedWidgets } = storeToRefs(dashboardStore)

const widget = computed(() => {
  return (props.widgetId ? openedWidgets.value?.find((w) => w.id === props.widgetId) : undefined) as Widget
})

const isChart = computed(() => chartTypes.includes(widget.value.widget_type))
const isNumber = computed(() => widget.value.widget_type === WidgetTypeType.Number)
const isStaticText = computed(() => widget.value.widget_type === WidgetTypeType.StaticText)
const isButton = computed(() => widget.value.widget_type === WidgetTypeType.Button)
</script>

<template>
  <template v-if="widget">
    <LayoutsWidgetsChart v-if="isChart" :widget-config="widget as ChartWidget" />
    <LayoutsWidgetsNumber v-else-if="isNumber" :widget-config="widget as NumberWidget" />
    <LayoutsWidgetsText v-else-if="isStaticText" :widget-config="widget as StaticTextWidget" />
    <LayoutsWidgetsButton v-else-if="isButton" :widget-config="widget as ButtonWidget" />

    <div v-else>Visualisation Type '{{ widget.widget_type }}' not yet implemented</div>
  </template>
</template>

<script lang="ts" setup>
import type { ButtonWidget, ChartWidget, NumberWidget, StaticTextWidget, Widget } from 'nocodb-sdk'
import { WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed } from '#imports'

const props = defineProps<{
  widget: Widget
}>()

const widget = toRefs(props).widget

const widgetWithReloadDataSupportRef = ref<HTMLElement | null>(null)

const isChart = computed(() => chartTypes.includes(widget.value.widget_type))
const isNumber = computed(() => widget.value.widget_type === WidgetTypeType.Number)
const isStaticText = computed(() => widget.value.widget_type === WidgetTypeType.StaticText)
const isButton = computed(() => widget.value.widget_type === WidgetTypeType.Button)

const { dataLinkConfigIsMissing } = useWidget(widget)

const dashboardStore = useDashboardStore()
const { focusedWidget } = storeToRefs(dashboardStore)

const borderClass = computed(() => {
  if (widget.value.id === focusedWidget.value?.id) {
    return 'nc-layout-ui-element-has-focus'
  } else if (dataLinkConfigIsMissing.value) {
    return 'nc-layout-ui-element-missing-data-config'
  } else {
    return ''
  }
})
</script>

<template v-slot:item="{ element: widget }">
  <div v-if="widget" class="nc-layout-ui-element" :class="borderClass">
    <LayoutsWidgetsChart v-if="isChart" :widget-config="widget as ChartWidget" />
    <LayoutsWidgetsNumber v-else-if="isNumber" ref="widgetWithReloadDataSupportRef" :widget-config="widget as NumberWidget" />
    <LayoutsWidgetsText v-else-if="isStaticText" :widget-config="widget as StaticTextWidget" />
    <LayoutsWidgetsButton v-else-if="isButton" :widget-config="widget as ButtonWidget" />
    <div v-else>Visualisation Type '{{ widget.widget_type }}' not yet implemented</div>
  </div>
</template>

<style scoped lang="scss">
.nc-layout-ui-element {
  @apply h-full;
  border: 1px solid #ddddddaf;
  padding: 13px;
  border-radius: 24px;

  &-has-focus,
  &:hover {
    padding: 10px;
    border: 4px solid #3366ff;
  }
}
</style>

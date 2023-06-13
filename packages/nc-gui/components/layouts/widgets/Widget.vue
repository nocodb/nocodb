<script lang="ts" setup>
import type { Widget } from 'nocodb-sdk'
import { ButtonWidget, ChartWidget, NumberWidget, StaticTextWidget, WidgetTypeType, chartTypes } from 'nocodb-sdk'
import { computed } from '#imports'

const props = defineProps<{
  widget: Widget
}>()

const contextMenuTarget = ref<Widget | null>(null)

const contextMenuVisible = ref(false)

const widget = toRefs(props).widget

const isChart = computed(() => chartTypes.includes(widget.value.widget_type))
const isNumber = computed(() => widget.value.widget_type === WidgetTypeType.Number)
const isStaticText = computed(() => widget.value.widget_type === WidgetTypeType.StaticText)
const isButton = computed(() => widget.value.widget_type === WidgetTypeType.Button)

const { dataLinkConfigIsMissing } = useWidget(widget)

const dashboardStore = useDashboardStore()
const { focusedWidget } = storeToRefs(dashboardStore)

const showContextMenu = (e: MouseEvent, target?: Widget) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
  contextMenuVisible.value = true
}

const duplicateWidget = () => {
  // Implement the logic to duplicate the widget here
  contextMenuVisible.value = false
}

const deleteWidget = () => {
  // Implement the logic to delete the widget here
  contextMenuVisible.value = false
}

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
  <div v-if="widget" class="nc-layout-ui-element" :class="borderClass" @contextmenu="showContextMenu($event, widget)">
    <LayoutsWidgetsChart v-if="isChart" :widget-config="widget as ChartWidget" />
    <LayoutsWidgetsNumber v-else-if="isNumber" :widget-config="widget as NumberWidget" />
    <LayoutsWidgetsText v-else-if="isStaticText" :widget-config="widget as StaticTextWidget" />
    <LayoutsWidgetsButton v-else-if="isButton" :widget-config="widget as ButtonWidget" />
    <div v-if="contextMenuVisible" class="bg-white rounded-md border-1 z-100">
      <button @click="duplicateWidget">Duplicate</button>
      <button @click="deleteWidget">Delete</button>
    </div>

    <div v-else>Visualisation Type '{{ widget.widget_type }}' not yet implemented</div>
  </div>
</template>

<style scoped lang="scss">
.nc-layout-ui-element {
  @apply h-full;
  border: 4px solid transparent;
  padding: 10px;
  border-radius: 24px;

  &-has-focus {
    border: 4px solid #3366ff;
  }

  &-missing-data-config {
    border: 4px solid red;
  }
}
</style>

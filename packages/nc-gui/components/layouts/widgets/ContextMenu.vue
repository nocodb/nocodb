<script lang="ts" setup>
import { computed, toRefs } from 'vue'
import { WidgetTypeType } from 'nocodb-sdk'
import type { Widget } from 'nocodb-sdk'
import { WidgetTypeText } from '../types'
const props = defineProps<{
  widget: Widget
}>()

const emits = defineEmits(['closeContextMenu'])

const widget = toRefs(props).widget
const contextMenuRef = ref<HTMLElement | null>(null)

const dashboardStore = useDashboardStore()
const { duplicateWidget, removeWidgetById } = dashboardStore

const getWidgetTypeText = (type: WidgetTypeType): string => {
  switch (type) {
    case WidgetTypeType.Number:
      return WidgetTypeText.Number
    case WidgetTypeType.StaticText:
      return WidgetTypeText.StaticText
    case WidgetTypeType.LineChart:
      return WidgetTypeText.LineChart
    case WidgetTypeType.BarChart:
      return WidgetTypeText.BarChart
    case WidgetTypeType.PieChart:
      return WidgetTypeText.PieChart
    case WidgetTypeType.ScatterPlot:
      return WidgetTypeText.ScatterPlot
    case WidgetTypeType.Button:
      return WidgetTypeText.Button
    case WidgetTypeType.Image:
      return WidgetTypeText.Image
    case WidgetTypeType.Divider:
      return WidgetTypeText.Divider
    default:
      return ''
  }
}

const widgetTypeText = computed(() => (widget.value && getWidgetTypeText(widget.value.widget_type)) || '')

const handleDocumentClick = (event: MouseEvent) => {
  alert('click')
  console.log('event: ', event)
  // Check if the click target is outside the child component
  if (contextMenuRef.value && !contextMenuRef.value.contains(event.target as Node)) {
    emits('closeContextMenu')
  }
}

onMounted(() => {
  // Add a click event listener to the document when the component is mounted
  document.addEventListener('click', handleDocumentClick)
})
onUnmounted(() => {
  // Remove the event listener when the component is unmounted
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="contextMenuRef" class="fixed bg-white !rounded-lg border-1 border-gray-100 z-1000 flex flex-col shadow-md w-max">
    <h3 class="font-normal text-gray-500 mb-0 p-4 border-b-1 border-gray-100">{{ widgetTypeText }} Widget</h3>
    <div class="py-4 flex flex-col gap-2">
      <a-button class="!border-none hover:opacity-50" @click="duplicateWidget(widget!.id)">
        <div class="text-gray-600 flex items-center justify-start">
          <GeneralIcon icon="duplicate" />
          <h3 class="ml-1 text-inherit mb-0">{{ $t('general.duplicate') }}</h3>
        </div>
      </a-button>
      <a-button class="!border-none hover:opacity-75" @click="removeWidgetById(widget!.id)">
        <div class="text-red-500 flex items-center justify-start">
          <GeneralIcon icon="delete" />
          <h3 class="ml-1 text-inherit mb-0">{{ $t('general.delete') }}</h3>
        </div>
      </a-button>
    </div>
  </div>
</template>

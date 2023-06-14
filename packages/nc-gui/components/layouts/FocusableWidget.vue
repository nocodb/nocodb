<script lang="ts" setup>
import type { Widget } from 'nocodb-sdk'
import { WidgetTypeType } from 'nocodb-sdk'
import { WidgetTypeText } from './types'

const props = defineProps<{ widgetId: string }>()

const widgetId = toRefs(props).widgetId

const nodeRef = ref<HTMLElement | null>(null)

const dashboardStore = useDashboardStore()
const { openedWidgets } = storeToRefs(dashboardStore)
const { removeWidgetById, updateFocusedWidgetByElementId, duplicateWidget } = dashboardStore

const contextMenuTarget = ref<Widget | null>(null)

const contextMenuVisible = ref(false)

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

const showContextMenu = (e: MouseEvent, target?: Widget) => {
  e.preventDefault()
  if (target) {
    contextMenuTarget.value = target
  }
  contextMenuVisible.value = true
}

const closeContextMenu = () => {
  contextMenuVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})

const widget = computed(() => {
  return openedWidgets.value?.find((w) => w.id === widgetId.value)
})

const widgetTypeText = computed(() => getWidgetTypeText(widget.value.widget_type))
</script>

<!-- TODO: check if @click.stop can be replaced by @click in the div below -->
<template>
  <div
    ref="nodeRef"
    class="p-6 h-full context-menu-trigger"
    @click="updateFocusedWidgetByElementId(widgetId)"
    @contextmenu="showContextMenu($event, widget)"
  >
    <LayoutsWidgetsWidget v-if="widget" :widget="widget" />
    <div v-if="contextMenuVisible" class="bg-white !rounded-lg border-1 border-gray-100 z-1000 flex flex-col shadow-md w-max">
      <h3 class="font-normal text-gray-500 mb-0 p-4 border-b-1 border-gray-100">{{ widgetTypeText }} Widget</h3>
      <div class="py-4 flex flex-col gap-2">
        <a-button class="!border-none hover:opacity-50" @click="duplicateWidget(widgetId)">
          <div class="text-gray-600 flex items-center justify-start">
            <GeneralIcon icon="duplicate" />
            <h3 class="ml-1 text-inherit mb-0">{{ $t('general.duplicate') }}</h3>
          </div>
        </a-button>
        <a-button class="!border-none hover:opacity-75" @click="removeWidgetById(widgetId)">
          <div class="text-red-500 flex items-center justify-start">
            <GeneralIcon icon="delete" />
            <h3 class="ml-1 text-inherit mb-0">{{ $t('general.delete') }}</h3>
          </div>
        </a-button>
      </div>
    </div>
  </div>
</template>

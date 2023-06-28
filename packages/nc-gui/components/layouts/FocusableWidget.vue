<script lang="ts" setup>
const props = defineProps<{ widgetId: string }>()
const widgetId = toRefs(props).widgetId

const nodeRef = ref<HTMLElement | null>(null)

const dashboardStore = useDashboardStore()
const { openedWidgets } = storeToRefs(dashboardStore)
const { updateFocusedWidgetByElementId } = dashboardStore

const widget = computed(() => {
  return openedWidgets.value?.find((w) => w.id === widgetId.value)
})
</script>

<template>
  <div ref="nodeRef" class="h-full context-menu-trigger" @click="updateFocusedWidgetByElementId(widgetId)">
    <LayoutsWidgetsWidget v-if="widget" :widget="widget" />
    <!-- TODO 
      - place the context menu in a separate component 
    -->
  </div>
</template>

<script lang="ts" setup>

const props = defineProps<{ widgetId: string }>()

const widgetId = toRefs(props).widgetId

const nodeRef = ref<HTMLElement | null>(null)

const dashboardStore = useDashboardStore()
const { openedWidgets } = storeToRefs(dashboardStore)
const { removeWidgetById, updateFocusedWidgetByElementId } = dashboardStore

const widget = computed(() => {
  return openedWidgets.value?.find((w) => w.id === widgetId.value)
})
</script>

<template>
  <div ref="nodeRef" class="p-6 h-full" @click.stop="updateFocusedWidgetByElementId(widgetId)">
    <LayoutsWidgetsWidget v-if="widget" :widget="widget" />
    <MdiTrashCanCircleOutline class="text-lg mr-2" @click="removeWidgetById(widgetId)" />
  </div>
</template>

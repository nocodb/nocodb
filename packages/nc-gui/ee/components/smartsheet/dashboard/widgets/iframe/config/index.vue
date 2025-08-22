<script setup lang="ts">
import type { IframeWidgetType, WidgetTypes } from 'nocodb-sdk'

const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { updateWidget } = useWidgetStore()
const { activeDashboardId } = storeToRefs(useDashboardStore())

const selectedIframeWidget = computed<IframeWidgetType | null>(() => {
  return selectedWidget.value as IframeWidgetType
})

const handleConfigUpdate = async (type: string, updates: any) => {
  if (!selectedWidget.value?.id || !activeDashboardId.value) {
    return
  }
  if (type === 'url') {
    await updateWidget<WidgetTypes.IFRAME>(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        url: updates.url,
      },
    })
  }
}
</script>

<template>
  <div v-if="selectedIframeWidget">
    <SmartsheetDashboardWidgetsCommonConfig disable-appearance>
      <template #data>
        <SmartsheetDashboardWidgetsIframeConfigUrl @update:url="handleConfigUpdate('url', $event)" />
      </template>
    </SmartsheetDashboardWidgetsCommonConfig>
  </div>
</template>

<style scoped lang="scss"></style>

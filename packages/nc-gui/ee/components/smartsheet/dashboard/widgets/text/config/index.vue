<script setup lang="ts">
import { WidgetTypes } from 'nocodb-sdk'
import type { TextWidgetConfig, TextWidgetType } from 'nocodb-sdk'

const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { updateWidget } = useWidgetStore()
const { activeDashboardId } = storeToRefs(useDashboardStore())

const isTextWidget = (widget: any): widget is TextWidgetType => {
  return widget?.type === WidgetTypes.TEXT
}

const selectedTextWidget = computed<TextWidgetType | null>(() => {
  const widget = selectedWidget.value
  return widget && isTextWidget(widget) ? widget : null
})

async function handleConfigUpdate(type: 'content', updates: string): Promise<void>
async function handleConfigUpdate(type: 'appearance', updates: Partial<TextWidgetConfig['appearance']>): Promise<void>
async function handleConfigUpdate(type: 'formatting', updates: Partial<TextWidgetConfig['formatting']>): Promise<void>
async function handleConfigUpdate(type: 'text' | 'content' | 'appearance' | 'formatting', updates: any): Promise<void> {
  const widget = selectedTextWidget.value
  const dashboardId = activeDashboardId.value

  if (!widget?.id || !dashboardId) {
    return
  }

  switch (type) {
    case 'content':
      await updateWidget<WidgetTypes.TEXT>(dashboardId, widget.id, {
        config: {
          ...widget.config,
          content: updates,
        },
      })
      break

    case 'appearance':
      await updateWidget<WidgetTypes.TEXT>(dashboardId, widget.id, {
        config: {
          ...widget.config,
          appearance: {
            ...widget.config?.appearance,
            ...updates,
          },
        },
      })
      break

    case 'formatting':
      await updateWidget<WidgetTypes.TEXT>(dashboardId, widget.id, {
        config: {
          ...widget.config,
          formatting: {
            ...widget.config?.formatting,
            ...updates,
          },
        },
      })
      break
  }
}
</script>

<template>
  <div v-if="selectedTextWidget">
    <SmartsheetDashboardWidgetsCommonConfig>
      <template #data>
        <SmartsheetDashboardWidgetsTextConfigContent
          :widget="selectedTextWidget"
          @update:content="handleConfigUpdate('content', $event)"
        />

        <SmartsheetDashboardWidgetsTextConfigFormatting
          :widget="selectedTextWidget"
          @update:formatting="handleConfigUpdate('formatting', $event)"
        />
      </template>

      <template #appearance>
        <SmartsheetDashboardWidgetsTextConfigAppearance
          :widget="selectedTextWidget"
          @update:appearance="handleConfigUpdate('appearance', $event)"
        />
      </template>
    </SmartsheetDashboardWidgetsCommonConfig>
  </div>

  <div v-else class="text-center text-gray-500 p-4">No text widget selected</div>
</template>

<style scoped lang="scss"></style>

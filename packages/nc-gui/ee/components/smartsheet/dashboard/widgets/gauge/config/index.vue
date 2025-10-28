<script setup lang="ts">
import GroupedSettings from '../../common/GroupedSettings.vue'

const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { updateWidget } = useWidgetStore()
const { activeDashboardId } = storeToRefs(useDashboardStore())

const handleConfigUpdate = async (type: string, updates: any) => {
  if (type === 'text') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, updates)
  } else if (type === 'dataSource') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      fk_model_id: updates?.fk_model_id,
      fk_view_id: updates?.fk_view_id,
      config: {
        ...selectedWidget.value?.config,
        dataSource: updates.type,
      },
    })
  } else if (type === 'metric') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        metric: {
          ...selectedWidget.value?.config?.metric,
          ...updates,
        },
      },
    })
  } else if (type === 'range') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        range: {
          ...selectedWidget.value?.config?.range,
          ...updates,
        },
      },
    })
  } else if (type === 'appearance') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        appearance: {
          ...selectedWidget.value?.config?.appearance,
          ...updates,
        },
      },
    })
  }
}
</script>

<template>
  <SmartsheetDashboardWidgetsCommonConfig>
    <template #data>
      <SmartsheetDashboardWidgetsCommonDataText @update:widget="handleConfigUpdate('text', $event)" />
      <SmartsheetDashboardWidgetsCommonDataSource @update:source="handleConfigUpdate('dataSource', $event)" />
      <GroupedSettings title="Display">
        <SmartsheetDashboardWidgetsCommonDataAggregation @update:aggregation="handleConfigUpdate('metric', $event)" />
      </GroupedSettings>
      <GroupedSettings title="Range">
        <SmartsheetDashboardWidgetsGaugeConfigRange @update:range="handleConfigUpdate('range', $event)" />
      </GroupedSettings>
    </template>
    <template #appearance>
      <SmartsheetDashboardWidgetsGaugeConfigAppearance @update:appearance="handleConfigUpdate('appearance', $event)" />
    </template>
  </SmartsheetDashboardWidgetsCommonConfig>
</template>

<script setup lang="ts">
import GroupedSettings from '../Common/GroupedSettings.vue'

const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { updateWidget } = useWidgetStore()
const { activeDashboard } = storeToRefs(useDashboardStore())

const handleConfigUpdate = async (type: string, updates: any) => {
  if (type === 'text') {
    await updateWidget(activeDashboard.value.id, selectedWidget.value.id, updates)
  } else if (type === 'dataSource') {
    await updateWidget(activeDashboard.value.id, selectedWidget.value.id, {
      config: {
        ...selectedWidget.value.config,
        dataSource: {
          ...selectedWidget.value.config.dataSource,
          ...updates,
        },
      },
    })
  } else if (type === 'metric') {
    await updateWidget(activeDashboard.value.id, selectedWidget.value.id, {
      config: {
        ...selectedWidget.value.config,
        metric: {
          ...selectedWidget.value.config.metric,
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
    </template>
  </SmartsheetDashboardWidgetsCommonConfig>
</template>

<style scoped lang="scss">
.nc-number-config {
  background: white;
  border-left: 1px solid var(--nc-content-gray-300);
  width: 320px;
  min-height: 100%;
}
</style>

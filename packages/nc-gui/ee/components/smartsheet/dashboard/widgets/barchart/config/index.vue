<script setup lang="ts">
const widgetStore = useWidgetStore()
const { selectedWidget } = storeToRefs(widgetStore)
const { updateWidget } = useWidgetStore()
const { activeDashboardId } = storeToRefs(useDashboardStore())

const handleConfigUpdate = async (type: string, updates: any) => {
  if (!selectedWidget.value?.id || !activeDashboardId.value) {
    return
  }
  if (type === 'text') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, updates)
  } else if (type === 'dataSource') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      fk_model_id: updates?.fk_model_id,
      fk_view_id: updates?.fk_view_id ?? null,
      config: {
        ...selectedWidget.value?.config,
        dataSource: updates.type,
      },
    })
  } else if (type === 'xAxis') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        data: {
          ...selectedWidget.value?.config?.data,
          xAxis: {
            ...selectedWidget.value?.config?.data?.xAxis,
            ...updates,
          },
        },
      },
    })
  } else if (type === 'yAxis') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        data: {
          ...selectedWidget.value?.config?.data,
          yAxis: {
            ...selectedWidget.value?.config?.data?.yAxis,
            ...updates,
          },
        },
      },
    })
  } else if (type === 'permission') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        permission: {
          ...selectedWidget.value?.config?.permission,
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
  } else if (type === 'size') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      position: {
        ...selectedWidget.value?.position,
        ...updates,
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
      <SmartsheetDashboardWidgetsCommonDataXAxis @update:x-axis="handleConfigUpdate('xAxis', $event)" />
      <SmartsheetDashboardWidgetsCommonDataYAxis @update:y-axis="handleConfigUpdate('yAxis', $event)" />
      <!--
      <SmartsheetDashboardWidgetsCommonDataPermission @update:permission="handleConfigUpdate('permission', $event)" />
-->
    </template>
    <template #appearance>
      <SmartsheetDashboardWidgetsBarchartConfigAppearance
        @update:appearance="handleConfigUpdate('appearance', $event)"
        @update:size="handleConfigUpdate('size', $event)"
      />
    </template>
  </SmartsheetDashboardWidgetsCommonConfig>
</template>

<script setup lang="ts">
import GroupedSettings from '../../common/GroupedSettings.vue'

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
  } else if (type === 'data.value') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        data: {
          ...selectedWidget.value?.config?.data,
          value: {
            ...selectedWidget.value?.config?.data?.value,
            ...updates,
          },
        },
      },
    })
  } else if (type === 'data.category') {
    await updateWidget(activeDashboardId.value, selectedWidget.value?.id, {
      config: {
        ...selectedWidget.value?.config,
        data: {
          ...selectedWidget.value?.config?.data,
          category: {
            ...selectedWidget.value?.config?.data?.category,
            ...updates,
          },
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
      <GroupedSettings title="Data">
        <SmartsheetDashboardWidgetsPiechartConfigCategory @update:category="handleConfigUpdate('data.category', $event)" />
        <div class="flex flex-col gap-4 pt-3">
          <div class="text-nc-content-gray text-bodyBold">Value</div>
          <SmartsheetDashboardWidgetsCommonDataAggregation
            :show-count-aggregation="true"
            @update:aggregation="handleConfigUpdate('data.value', $event)"
          />
        </div>
      </GroupedSettings>
      <!--
      <SmartsheetDashboardWidgetsCommonDataPermission @update:permission="handleConfigUpdate('permission', $event)" />
-->
    </template>
    <template #appearance>
      <SmartsheetDashboardWidgetsPiechartConfigAppearance
        @update:appearance="handleConfigUpdate('appearance', $event)"
        @update:size="handleConfigUpdate('size', $event)"
      />
    </template>
  </SmartsheetDashboardWidgetsCommonConfig>
</template>

<style scoped lang="scss"></style>

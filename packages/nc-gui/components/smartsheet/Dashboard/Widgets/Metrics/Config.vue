<script setup lang="ts">
import type { WidgetType } from 'nocodb-sdk'
import GroupedSettings from '../Common/GroupedSettings.vue'
interface Props {
  widget: WidgetType
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:config': [config: any]
}>()

// Watch for changes and emit updates
watchEffect(() => {})
</script>

<template>
  <SmartsheetDashboardWidgetsCommonConfig>
    <template #data>
      <SmartsheetDashboardWidgetsCommonDataText />
      <SmartsheetDashboardWidgetsCommonDataSource />
      <GroupedSettings title="Display">
        <SmartsheetDashboardWidgetsCommonDataAggregation />
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

<script lang="ts" setup>
import { Widget, WidgetTypeType, chartTypes } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { focusedWidget } = storeToRefs(dashboardStore)
const { changeChartTypeOfFocusedChartElement } = dashboardStore

const { t } = useI18n()

const dataOrAppearanceMode = ref('data')

// TODO: extrat these out and reuse them here and in the widget components
const isChart = computed(() => focusedWidget.value && chartTypes.includes(focusedWidget.value.widget_type))
const isText = computed(() => focusedWidget.value && [WidgetTypeType.StaticText].includes(focusedWidget.value.widget_type))
const isNumber = computed(() => focusedWidget.value && [WidgetTypeType.Number].includes(focusedWidget.value.widget_type))
const isButton = computed(() => focusedWidget.value && [WidgetTypeType.Button].includes(focusedWidget.value.widget_type))
const chartTypesForDropdown = computed(() =>
  chartTypes.map((widgetType: WidgetTypeType) => ({
    id: widgetType,
    title: t(`dashboards.widgets.${widgetType}`),
  })),
)
</script>

<template>
  <h3 class="uppercase text-md text-gray-500">Properties</h3>
  <a-divider />
  <template v-if="focusedWidget">
    <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
      v-if="chartTypes.includes(focusedWidget?.widget_type)"
      v-model="(focusedWidget as Widget).widget_type"
      :id-and-title-tuple-list="chartTypesForDropdown"
      label-text="Chart"
      @change-selected-value="changeChartTypeOfFocusedChartElement($event)"
    />
    <div v-else-if="focusedWidget?.widget_type">
      {{ $t(`dashboards.widgets.${focusedWidget.widget_type}`) }}
    </div>
    <LayoutsWidgetsPropertiesPanelTopSectionsNumber v-if="isNumber" />
    <LayoutsWidgetsPropertiesPanelTopSectionsButton v-if="isButton" />
    <LayoutsWidgetsPropertiesPanelTopSectionsText v-if="isText" />

    <a-divider />

    <div v-if="dataOrAppearanceMode === 'data'">
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsChart v-if="isChart" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsText v-if="isText" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsNumber v-if="isNumber" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsButton v-if="isButton" />
    </div>
  </template>
</template>

<style scoped lang="scss">
.nc-radio-group {
  @apply flex w-full bg-gray-200 p-1 rounded-lg;
}

.nc-radio-button {
  @apply flex-grow rounded-lg text-center;
}
</style>

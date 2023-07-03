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

const hasAppearanceSection = computed(() => isNumber || isText)

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
    <LayoutsWidgetsPropertiesPanelTopSectionsChart v-if="isChart" />

    <div v-if="hasAppearanceSection" class="flex flex-row p-1 mt-3 mb-3 bg-gray-50 rounded-md gap-x-2">
      <div
        class="tab"
        :class="{
          active: dataOrAppearanceMode === 'data',
        }"
        @click="dataOrAppearanceMode = 'data'"
      >
        <component
          :is="iconMap.code"
          class="text-gray-500"
          :style="{
            fontWeight: 600,
          }"
        />
        <div>Data</div>
      </div>
      <div
        class="tab"
        :class="{
          active: dataOrAppearanceMode === 'appearance',
        }"
        @click="dataOrAppearanceMode = 'appearance'"
      >
        <component
          :is="iconMap.palette"
          class="text-gray-500"
          :style="{
            fontWeight: 600,
          }"
        />
        <div>Appearance</div>
      </div>
    </div>
    
    <a-divider />

    <div v-if="dataOrAppearanceMode === 'data'">
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsChart v-if="isChart" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsText v-if="isText" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsNumber v-if="isNumber" />
      <LayoutsWidgetsPropertiesPanelDataConfigSectionsButton v-if="isButton" />
    </div>
    <div v-else-if="dataOrAppearanceMode === 'appearance'">
      <LayoutsWidgetsPropertiesPanelAppearanceConfigSectionsNumber v-if="isNumber" />
      <LayoutsWidgetsPropertiesPanelAppearanceConfigSectionsText v-if="isText" />
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

:deep(.ant-menu-title-content) {
  @apply w-full;
}

:deep(.ant-layout-sider-children) {
  @apply flex flex-col;
}

.tab {
  @apply flex flex-row items-center justify-center w-1/2 py-1 bg-gray-50 rounded-md gap-x-1.5 text-gray-500 cursor-pointer transition-all duration-300 select-none;
}
.active {
  @apply bg-white shadow text-gray-700;
}
</style>

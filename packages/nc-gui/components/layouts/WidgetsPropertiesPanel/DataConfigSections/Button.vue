<script setup lang="ts">
import { ButtonActionType } from 'nocodb-sdk'
import type { ButtonWidget } from 'nocodb-sdk'
import { availableButtonActionTypes } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const { t } = useI18n()

const { focusedWidget } = storeToRefs(dashboardStore)
const { changeButtonActionTypeOfFocusedWidget, changeButtonTextOfFocusedButtonWidget, changeExternalUrlOfFocusedButtonWidget } =
  dashboardStore
const focusedButtonWidget = computed(() => focusedWidget.value as ButtonWidget | undefined)

const availableButtonActionTypesWithIdAndTitle = [
  {
    id: null,
    title: '',
  },
  ...availableButtonActionTypes.map((actionType) => ({
    id: actionType,
    title: t(`dashboards.buttonActionTypes.${actionType}`),
  })),
]

const isExternalUrlActionType = computed(
  () => focusedButtonWidget.value?.data_config?.actionType === ButtonActionType.OPEN_EXTERNAL_URL,
)
</script>

<template>
  <a-collapse expand-icon-position="right" accordion>
    <a-collapse-panel header="Function">
      <DashboardsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
        v-model="focusedButtonWidget!.data_config.actionType"
        label-text="Select if your button has any function."
        :id-and-title-tuple-list="availableButtonActionTypesWithIdAndTitle"
        @change-selected-value="changeButtonActionTypeOfFocusedWidget($event as ButtonActionType)"
      />
      <a-input
        id="nc-dashboard-property-panel-button-external-url"
        placeholder="Button Text"
        :value="focusedButtonWidget.data_config.buttonText"
        @update:value="changeButtonTextOfFocusedButtonWidget($event)"
      />

      <template v-if="isExternalUrlActionType"
        ><a-input
          id="nc-dashboard-property-panel-button-external-url"
          placeholder="URL"
          :value="focusedButtonWidget.data_config.url"
          @update:value="changeExternalUrlOfFocusedButtonWidget($event)"
      /></template>
    </a-collapse-panel>
  </a-collapse>
</template>

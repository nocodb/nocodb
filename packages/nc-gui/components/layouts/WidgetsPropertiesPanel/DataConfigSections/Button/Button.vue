<script setup lang="ts">
import type { SelectValue } from 'ant-design-vue/lib/select'
import { ButtonActionType } from 'nocodb-sdk'
import type { ButtonWidget } from 'nocodb-sdk'
import { availableButtonActionTypes } from '~~/store/dashboard'
const dashboardStore = useDashboardStore()
const { t } = useI18n()

const { focusedWidget } = storeToRefs(dashboardStore)
const { changeButtonActionTypeOfFocusedWidget, changeExternalUrlOfFocusedButtonWidget } = dashboardStore
const focusedButtonWidget = computed(() => focusedWidget.value as ButtonWidget | undefined)

const sectionOptions: SectionTypeChooserOption[] = [
  ...availableButtonActionTypes.map((actionType) => ({
    id: actionType,
    label: t(`dashboards.buttonActionTypes.${actionType}`),
  })),
]

const isExternalUrlActionType = computed(
  () => focusedButtonWidget.value?.data_config?.actionType === ButtonActionType.OPEN_EXTERNAL_URL,
)

interface SectionTypeChooserOption {
  id: ButtonActionType
  label: string
}

const updateSelectedValue = (value: SelectValue) => {
  changeButtonActionTypeOfFocusedWidget(value as ButtonActionType)
}

const selectedActionType = computed(() => focusedButtonWidget.value?.data_config?.actionType)
</script>

<template>
    <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel !rounded-lg" header="Function">
      <a-select :value="selectedActionType" class="mb-4" option-filter-prop="children" @change="updateSelectedValue">
        <a-select-option v-for="option of sectionOptions" :key="option.id" :value="option.id">
          {{ option.label }}
        </a-select-option>
      </a-select>
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

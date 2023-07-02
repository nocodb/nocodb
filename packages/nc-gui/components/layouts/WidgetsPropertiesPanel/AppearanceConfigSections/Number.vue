<script setup lang="ts">
import type { NumberWidget } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeTextColorOfFocusedWidget } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const colors = [
  {
    label: 'Red',
    value: 'red',
  },
  {
    label: 'Blue',
    value: 'blue',
  },
  {
    label: 'Green',
    value: 'green',
  },
]

const numberWidget = computed(() => {
  return focusedWidget.value as NumberWidget
})
const selectedTextColor = ref(numberWidget.value.appearance_config.textColor)

watch(
  () => selectedTextColor.value,
  (val) => {
    val && changeTextColorOfFocusedWidget(val)
  },
)
</script>

<template>
  <a-collapse expand-icon-position="right" accordion class="nc-dashboard-props-panel-collapse-group">
    <a-collapse-panel header="Style">
      <LayoutsWidgetsPropertiesPanelAppearanceConfigSectionsNumberIconPicker />
      <template #extra><setting-outlined /></template>
      <a-select
        v-model:value="selectedTextColor"
        :dropdown-match-select-width="false"
        :placeholder="$t('placeholder.textColor')"
        dropdown-class-name="nc-dropdown-toolbar-field-list"
      >
        <a-select-option v-for="option in colors" :key="option.value" :label="option.label" :value="option.value">
          <Space>
            <div class="flex gap-2 items-center items-center h-full">
              <div
                role="img"
                :style="{
                  backgroundColor: option.value,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  marginRight: '8px',
                }"
              ></div>
              <span class="min-w-0"> {{ option.label }}</span>
            </div>
          </Space>
        </a-select-option>
      </a-select>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss"></style>

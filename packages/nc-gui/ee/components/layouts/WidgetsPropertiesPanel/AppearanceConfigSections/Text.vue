<script setup lang="ts">
import type { AppearanceConfigStaticText } from 'nocodb-sdk'
import { FontType } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeFontTypeOfFocusedTextWidget } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const availableFontTypeIdAndTitleTuples = Object.values(FontType).map((fontType) => ({
  id: fontType,
  title: fontType,
}))

const appearanceConfig = computed(() => focusedWidget.value?.appearance_config as AppearanceConfigStaticText)
</script>

<template>
  <a-collapse expand-icon-position="right" accordion class="nc-dashboard-props-panel-collapse-group">
    <a-collapse-panel header="Style">
      <div class="flex justify-between items-center mb-2">
        <label for="fontType">Font Type</label>
        <LayoutsWidgetsPropertiesPanelVisualisationConfigIdWithTitleSelectBox
          id="fontType"
          v-model="appearanceConfig.fontType"
          :id-and-title-tuple-list="availableFontTypeIdAndTitleTuples"
          class="w-[8rem]"
          @change-selected-value="changeFontTypeOfFocusedTextWidget($event as FontType)"
        />
      </div>
      <template #extra><setting-outlined /></template>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss"></style>

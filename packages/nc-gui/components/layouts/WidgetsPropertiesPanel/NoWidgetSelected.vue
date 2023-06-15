<script setup lang="ts">
import { SelectedLayoutDimension } from '../types'

const selectedLayoutDimension = ref(SelectedLayoutDimension.Vertical)

const minPadding = 0
const maxPadding = 100

const dashboardStore = useDashboardStore()
const { changeLayoutGap, changeLayoutPaddingHorizontal, changeLayoutPaddingVertical } = dashboardStore
const { openedLayoutSidebarNode } = storeToRefs(dashboardStore)

const localHorizontalPadding = ref(parseInt(openedLayoutSidebarNode.value?.grid_padding_horizontal || '50'))
const localVerticalPadding = ref(parseInt(openedLayoutSidebarNode.value?.grid_padding_vertical || '50'))
const localGap = ref(parseInt(openedLayoutSidebarNode.value?.grid_gap || '50'))

const onBlurGapInput = () => {
  if (localGap.value < minPadding) {
    localGap.value = minPadding
  } else if (localGap.value > maxPadding) {
    localGap.value = maxPadding
  }
  changeLayoutGap(String(localGap.value))
  selectedLayoutDimension.value = SelectedLayoutDimension.None
}
const onBlurPaddingHorizontalInput = () => {
  if (localHorizontalPadding.value < minPadding) {
    localHorizontalPadding.value = minPadding
  } else if (localHorizontalPadding.value > maxPadding) {
    localHorizontalPadding.value = maxPadding
  }
  changeLayoutPaddingHorizontal(String(localHorizontalPadding.value))
  selectedLayoutDimension.value = SelectedLayoutDimension.None
}
const onBlurPaddingVerticalInput = () => {
  if (localVerticalPadding.value < minPadding) {
    localVerticalPadding.value = minPadding
  } else if (localVerticalPadding.value > maxPadding) {
    localVerticalPadding.value = maxPadding
  }
  changeLayoutPaddingVertical(String(localVerticalPadding.value))
  selectedLayoutDimension.value = SelectedLayoutDimension.None
}
</script>

<!-- TODO: maybe make this a HTML section later -->
<template>
  <div>
    <!-- TODO: Check in browser if we use correct/consistent hierachies for header levels -->
    <h3></h3>
    <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
      <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel !rounded-lg" header="Layout">
        <h3 class="mb-4">Layout settings for page.</h3>
        <LayoutsWidgetsPropertiesPanelLayoutVisualizer :selected-layout-dimension="selectedLayoutDimension" />
        <div class="mt-4 px-2">
          <div class="nc-dashboard-layouts-propspanel-nowidget-selected-layout-formrow">
            <label for="nc-dashboard-props-panel-layout-vertical">Top & Bottom padding</label>
            <a-input
              id="nc-dashboard-props-panel-layout-vertical"
              v-model:value="localVerticalPadding"
              type="number"
              autocomplete="off"
              :min="minPadding"
              :max="maxPadding"
              @focus="() => (selectedLayoutDimension = SelectedLayoutDimension.Vertical)"
              @blur="onBlurPaddingVerticalInput"
              @press-enter="onBlurPaddingVerticalInput"
            />
          </div>
          <div class="nc-dashboard-layouts-propspanel-nowidget-selected-layout-formrow">
            <label for="nc-dashboard-props-panel-layout-horizontal">Left & Right padding</label>
            <a-input
              id="nc-dashboard-props-panel-layout-horizontal"
              v-model:value="localHorizontalPadding"
              type="number"
              autocomplete="off"
              :min="minPadding"
              :max="maxPadding"
              @focus="() => (selectedLayoutDimension = SelectedLayoutDimension.Horizontal)"
              @blur="onBlurPaddingHorizontalInput"
              @press-enter="onBlurPaddingHorizontalInput"
            />
          </div>
          <div class="nc-dashboard-layouts-propspanel-nowidget-selected-layout-formrow">
            <label for="nc-dashboard-props-panel-layout-gap">Gap</label>
            <a-input
              id="nc-dashboard-props-panel-layout-gap"
              v-model:value="localGap"
              type="number"
              autocomplete="off"
              :min="minPadding"
              :max="maxPadding"
              @focus="() => (selectedLayoutDimension = SelectedLayoutDimension.Gap)"
              @blur="onBlurGapInput"
              @press-enter="onBlurGapInput"
            />
          </div>
        </div>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<style scoped>
.nc-dashboard-layouts-propspanel-nowidget-selected-layout-formrow {
  @apply flex items-center mt-2 justify-between;
  .ant-input {
    @apply w-[64px] rounded-lg text-center;
  }
  .label {
    @apply w-2/3 text-left;
  }
}
</style>

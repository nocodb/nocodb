<script setup lang="ts">
import type { StaticTextWidget } from 'nocodb-sdk'

const dashboardStore = useDashboardStore()
const { changeFunctionTypeOfStaticTextWidget, changeUrlOfFocusedTextElement } = dashboardStore
const { focusedWidget } = storeToRefs(dashboardStore)

const staticTextWidget = computed(() => focusedWidget.value as StaticTextWidget | undefined)
const staticTextFunctionType = computed(
  () =>
    (staticTextWidget.value?.data_config.hasFunction && staticTextWidget.value?.data_config.staticTextFunction?.type) || false,
)
const localUrl = ref(staticTextWidget.value?.data_config.staticTextFunction?.url ?? '')
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel !rounded-lg" header="Function">
      <div class="flex flex-col m-0">
        <div class="nc-dashboard-layouts-propspanel-selectable-config-section pb-0 mb-2">
          <a-radio :checked="staticTextFunctionType === false" @change="changeFunctionTypeOfStaticTextWidget(false)"
            ><h3>None</h3></a-radio
          >
        </div>

        <div class="nc-dashboard-layouts-propspanel-selectable-config-section">
          <a-radio :checked="staticTextFunctionType === 'url'" @change="changeFunctionTypeOfStaticTextWidget('url')"
            ><h3>URL</h3></a-radio
          >
          <h4>Set hyperlink to text</h4>
          <div v-if="staticTextFunctionType === 'url'">
            <div class="flex justify-between items-center mb-2">
              <a-input
                v-model:value="localUrl"
                placeholder="URL"
                class="nc-dashboard-layouts-propspanel-value-input"
                @blur="() => changeUrlOfFocusedTextElement(localUrl)"
              />
            </div>
          </div>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

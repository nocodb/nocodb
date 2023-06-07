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
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-collapse-panel-custom">
    <a-collapse-panel class="nc-collapse-panel !rounded-lg" header="Function">
      <div class="flex flex-col m-0">
        <div class="bg-gray-100 rounded-lg p-2 pb-0 mb-2">
          <a-radio :checked="staticTextFunctionType === false" @change="changeFunctionTypeOfStaticTextWidget(false)"
            ><h3>None</h3></a-radio
          >
        </div>

        <div class="bg-gray-100 rounded-lg p-2">
          <a-radio :checked="staticTextFunctionType === 'url'" @change="changeFunctionTypeOfStaticTextWidget('url')"
            ><h3>URL</h3></a-radio
          >
          <h3 class="text-gray-500">Set hyperlink to text</h3>
          <div v-if="staticTextFunctionType === 'url'">
            <div class="flex justify-between items-center mb-2">
              <a-input
                v-model:value="localUrl"
                placeholder="URL"
                class="nc-value-input"
                @blur="() => changeUrlOfFocusedTextElement(localUrl)"
              />
            </div>
          </div>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style scoped lang="scss">
.nc-collapse-panel {
  @apply border border-solid border-grey-light rounded-lg my-2;
}
.nc-collapse-panel-custom {
  background-color: transparent;
}
:deep(.ant-collapse-content-box) {
}
:deep(.ant-radio-wrapper) {
  @apply m-0 mb-2;
}
</style>

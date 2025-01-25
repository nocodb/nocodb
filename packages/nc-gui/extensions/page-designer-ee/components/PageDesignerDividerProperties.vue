<script setup lang="ts">
import { PageDesignerPayloadInj } from '../lib/context'
import type { PageDesignerDividerWidget } from '../lib/widgets'
import GroupedSettings from './GroupedSettings.vue'
import ColorPropertyPicker from './ColorPropertyPicker.vue'

const payload = inject(PageDesignerPayloadInj)!

const dividerWidget = ref<PageDesignerDividerWidget>()
watch(
  () => payload.value.currentWidgetId,
  (id) => {
    dividerWidget.value = payload?.value?.widgets[id] as PageDesignerDividerWidget
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="dividerWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header>
      <h1 class="m-0">Divider</h1>
    </header>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="dividerWidget.backgroundColor" />
        </div>
      </div>
    </GroupedSettings>
  </div>
</template>

<style lang="scss" scoped>
.text-properties {
  header {
    h1 {
      font-size: 20px;
      font-weight: 700;
      line-height: 32px;
      letter-spacing: -0.4px;
      padding: 16px 24px;
      border-bottom: 1px solid;
      @apply border-nc-border-gray-medium;
    }
  }
  :deep(.ant-select-selection-item) {
    display: inline-block !important;
  }
  .border-inputs {
    .ant-input {
      @apply !rounded-lg h-8 w-8 text-center;
      padding: 2px;
      -moz-appearance: textfield; /*For FireFox*/

      &::-webkit-inner-spin-button {
        /*For Webkits like Chrome and Safari*/
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }
  .radio-picker {
    border-radius: 0.5rem;
    :first-child {
      border-radius: 0.5rem 0 0 0.5rem;
    }
    :last-child {
      border-radius: 0 0.5rem 0.5rem 0;
    }
  }
}
</style>

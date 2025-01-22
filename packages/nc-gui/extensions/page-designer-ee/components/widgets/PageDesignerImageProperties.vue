<script setup lang="ts">
import { PageDesignerPayloadInj } from '../../src/context'
import GroupedSettings from '../GroupedSettings.vue'
import ColorPropertyPicker from '../ColorPropertyPicker.vue'
import BorderImage from '../../assets/border.svg'
import type { PageDesignerImageWidget } from '../../src/widgets'

const payload = inject(PageDesignerPayloadInj)!
const index = payload.value.currentWidgetIndex ?? -1

const imageWidget = payload?.value?.widgets[index] as PageDesignerImageWidget
</script>

<template>
  <div v-if="imageWidget" class="flex flex-col text-properties overflow-y-auto max-h-full pb-8">
    <header>
      <h1 class="m-0">Image</h1>
    </header>
    <GroupedSettings title="Value">
      <a-input v-model:value="imageWidget.imageSrc" placeholder="Image URL" class="!rounded-lg"></a-input>
    </GroupedSettings>
    <GroupedSettings title="Fit">
      <div class="flex gap-3">
        <a-radio-group v-model:value="imageWidget.objectFit" class="radio-picker">
          <a-radio-button value="fill">Fill</a-radio-button>
          <a-radio-button value="contain">Contain</a-radio-button>
          <a-radio-button value="cover">Cover</a-radio-button>
        </a-radio-group>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Border">
      <div class="flex gap-2 items-center">
        <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
          <div>
            <a-input v-model:value="imageWidget.borderTop" type="number" min="0"></a-input>
          </div>
          <div class="flex gap-2 items-center">
            <a-input v-model:value="imageWidget.borderLeft" type="number" min="0"></a-input>
            <img :src="BorderImage" />
            <a-input v-model:value="imageWidget.borderRight" type="number" min="0"></a-input>
          </div>
          <div>
            <a-input v-model:value="imageWidget.borderBottom" type="number" min="0"></a-input>
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Color</span>
            <ColorPropertyPicker v-model="imageWidget.borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Radius</span>
            <a-input v-model:value="imageWidget.borderRadius" type="number" min="0" class="!rounded-lg" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="imageWidget.backgroundColor" />
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

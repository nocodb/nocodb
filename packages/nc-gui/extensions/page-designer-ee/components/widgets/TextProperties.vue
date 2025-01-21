<script setup lang="ts">
import { PageDesignerPayloadInj } from '../../src/context'
import GroupedSettings from '../GroupedSettings.vue'
import ColorPropertyPicker from '../ColorPropertyPicker.vue'
import BorderImage from '../../assets/border.svg'

defineProps<{
  index: number
}>()

const payload = inject(PageDesignerPayloadInj)

const fontWeightToLabel = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Normal',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Heavy',
}

const fonts = ['Arial', 'Tahoma', 'Times New Roman', 'Verdana', 'Courier New', 'Georgia', 'Impact', 'Trebuchet MS', 'Manrope']
const fontWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900]
</script>

<template>
  <div v-if="payload?.widgets?.[index]" class="flex flex-col text-properties overflow-y-auto max-h-full">
    <header>
      <h1 class="m-0">Text</h1>
    </header>
    <GroupedSettings title="Value">
      <a-input v-model:value="payload.widgets[index].value"></a-input>
    </GroupedSettings>
    <GroupedSettings title="Font settings">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Family</span>
          <NcSelect v-model:value="payload.widgets[index].fontFamily" show-search>
            <a-select-option v-for="font of fonts" :key="font" :value="font">
              {{ font }}
            </a-select-option>
          </NcSelect>
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Weight</span>
          <NcSelect v-model:value="payload.widgets[index].fontWeight">
            <a-select-option v-for="weight of fontWeights" :key="weight" :value="weight">
              {{ fontWeightToLabel[weight] }} - {{ weight }}
            </a-select-option>
          </NcSelect>
        </div>
      </div>
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Size</span>
          <a-input
            v-model:value="payload.widgets[index].fontSize"
            class="!rounded-lg flex-1"
            type="number"
            min="0"
            label="Font Size"
            placeholder="14"
          ></a-input>
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Line Height</span>
          <a-input
            v-model:value="payload.widgets[index].lineHeight"
            class="!rounded-lg flex-1"
            type="number"
            min="0"
            placeholder="Value"
          ></a-input>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Border">
      <div class="flex gap-2 items-center">
        <div class="flex flex-col gap-2 border-inputs justify-center items-center flex-1">
          <div>
            <a-input v-model:value="payload.widgets[index].borderTop" type="number" min="0"></a-input>
          </div>
          <div class="flex gap-2 items-center">
            <a-input v-model:value="payload.widgets[index].borderLeft" type="number" min="0"></a-input>
            <img :src="BorderImage" />
            <a-input v-model:value="payload.widgets[index].borderRight" type="number" min="0"></a-input>
          </div>
          <div>
            <a-input v-model:value="payload.widgets[index].borderBottom" type="number" min="0"></a-input>
          </div>
        </div>
        <div class="flex-1 flex flex-col gap-2">
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Color</span>
            <ColorPropertyPicker v-model="payload.widgets[index].borderColor" />
          </div>
          <div class="flex flex-col gap-2 flex-1 min-w-0">
            <span>Border Radius</span>
            <a-input v-model:value="payload.widgets[index].borderRadius" type="number" min="0" class="!rounded-lg" />
          </div>
        </div>
      </div>
    </GroupedSettings>
    <GroupedSettings title="Fill">
      <div class="flex gap-3">
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Background Color</span>
          <ColorPropertyPicker v-model="payload.widgets[index].backgroundColor" />
        </div>
        <div class="flex flex-col gap-2 flex-1 min-w-0">
          <span>Text Color</span>
          <ColorPropertyPicker v-model="payload.widgets[index].textColor" />
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
      @apply !rounded-lg h-8 w-8;
      padding: 2px;
      -moz-appearance: textfield; /*For FireFox*/

      &::-webkit-inner-spin-button {
        /*For Webkits like Chrome and Safari*/
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }
}
</style>
